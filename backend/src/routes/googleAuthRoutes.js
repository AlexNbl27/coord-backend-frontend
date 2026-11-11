import crypto from 'node:crypto';
import { Router } from 'express';
import { Cinema } from '../models/Cinema.js';
import { User } from '../models/User.js';
import {
  SESSION_COOKIE_NAME,
  allowInsecureCookies,
  getSessionCookieOptions,
  signSessionToken
} from '../services/sessionService.js';
import { isValidSlug } from '../tenancy/index.js';
import { createRateLimiter } from '../utils/securityMiddleware.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const STATE_COOKIE = 'cineslot_oauth';
const STATE_TTL_MS = 10 * 60 * 1000;
const HANDOFF_TTL_MS = 60 * 1000;
const DEFAULT_APP_URL = 'http://cineslot.localhost:3001';

export function isGoogleAuthEnabled(env = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * Google only accepts plain-http redirect URIs on localhost, not on *.cineslot.localhost.
 * When GOOGLE_REDIRECT_URI is on another host than APP_URL, the OAuth dance runs on that host
 * and the session is handed to the cinema host with a signed single-use token (relay).
 * Returns that OAuth hostname, or null when no relay is needed.
 */
export function googleOAuthRelayHost(env = process.env) {
  if (!env.GOOGLE_REDIRECT_URI) return null;
  const oauth = new URL(env.GOOGLE_REDIRECT_URI);
  return oauth.host === new URL(env.APP_URL || DEFAULT_APP_URL).host ? null : oauth.hostname;
}

const hashJti = (jti) => crypto.createHash('sha256').update(jti).digest('base64url');

function safeRedirectPath(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

/**
 * Google sign-in (OIDC code flow + PKCE), mounted on /api/session/google.
 */
export function createGoogleAuthRouter(deps = {}) {
  const env = deps.env || process.env;
  const users = deps.users || User;
  const cinemas = deps.cinemas || Cinema;
  const fetchImpl = deps.fetch || fetch;
  const appUrl = (env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, '');
  const redirectUri = env.GOOGLE_REDIRECT_URI || `${appUrl}/api/session/google/callback`;
  const relayHost = googleOAuthRelayHost(env);
  const oauthOrigin = new URL(redirectUri).origin;
  const stateSecret = env.SESSION_SECRET || 'dev-only-ephemeral-hmac-secret-key-32bytes';
  const cookieDomain = env.SESSION_COOKIE_DOMAIN || '.cineslot.localhost';
  const stateCookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production' && !allowInsecureCookies(env),
    sameSite: 'lax',
    // host-only on the relay host: the browser would refuse a .cineslot.localhost cookie from localhost
    domain: relayHost ? undefined : cookieDomain,
    path: '/api/session/google',
    maxAge: STATE_TTL_MS
  };
  const router = Router();
  const limiter = deps.limiter || createRateLimiter({ windowMs: 15 * 60_000, max: 30 });

  const signStateCookie = (data) => {
    const payload = Buffer.from(JSON.stringify(data), 'utf8').toString('base64url');
    const sig = crypto.createHmac('sha256', stateSecret).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  };

  const verifyStateCookie = (raw) => {
    if (typeof raw !== 'string') return null;
    const dot = raw.indexOf('.');
    if (dot <= 0) return null;
    const payload = raw.slice(0, dot);
    const sig = raw.slice(dot + 1);
    const expected = crypto.createHmac('sha256', stateSecret).update(payload).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    try {
      return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      return null;
    }
  };

  const fail = (res, reason) => {
    res.clearCookie(STATE_COOKIE, { path: stateCookieOptions.path, domain: stateCookieOptions.domain });
    return res.redirect(302, `${appUrl}/login?error=${reason}`);
  };

  router.use((req, res, next) => (isGoogleAuthEnabled(env) ? next() : res.status(404).end()));

  router.get('/', limiter, (req, res) => {
    const state = crypto.randomBytes(24).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const redirect = safeRedirectPath(req.query.redirect);
    const rawSlug = typeof req.query.slug === 'string' ? req.query.slug.trim() : req.tenant?.slug;
    const slug = isValidSlug(rawSlug) ? rawSlug : null;

    if (relayHost && req.hostname !== relayHost) {
      const relayStart = new URL('/api/session/google', oauthOrigin);
      relayStart.search = new URLSearchParams({ redirect, ...(slug ? { slug } : {}) }).toString();
      return res.redirect(302, relayStart.toString());
    }

    res.cookie(STATE_COOKIE, signStateCookie({ state, verifier, redirect, slug }), stateCookieOptions);
    const url = new URL(GOOGLE_AUTH_URL);
    url.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      prompt: 'select_account'
    }).toString();
    return res.redirect(302, url.toString());
  });

  router.get('/callback', limiter, async (req, res) => {
    const saved = verifyStateCookie(req.cookies?.[STATE_COOKIE]);
    const { code, state } = req.query;
    if (!saved || saved.typ || typeof state !== 'string' || typeof code !== 'string' || state !== saved.state) {
      return fail(res, 'google');
    }

    try {
      let targetBaseUrl = appUrl;
      if (saved.slug) {
        if (!isValidSlug(saved.slug)) {
          return fail(res, 'cinema_unavailable');
        }
        const query = cinemas.findOne({ slug: saved.slug }, 'status');
        const cinema = typeof query?.lean === 'function' ? await query.lean() : await query;
        if (!cinema || cinema.status !== 'ACTIVE') {
          return fail(res, 'cinema_unavailable');
        }
        const parsed = new URL(appUrl);
        parsed.hostname = `${saved.slug}.${parsed.hostname}`;
        targetBaseUrl = parsed.origin;
      }

      const tokenRes = await fetchImpl(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
          code_verifier: saved.verifier
        })
      });
      if (!tokenRes.ok) {
        return fail(res, 'google');
      }
      const { access_token: accessToken } = await tokenRes.json();

      const profileRes = await fetchImpl(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!profileRes.ok) {
        return fail(res, 'google');
      }
      const profile = await profileRes.json();
      if (typeof profile.sub !== 'string' || typeof profile.email !== 'string' || profile.email_verified !== true) {
        return fail(res, 'google');
      }

      let user = await users.findOne({ googleId: profile.sub });
      if (!user) {
        const email = profile.email.toLowerCase();
        // No auto-merge with password accounts: emails are not verified at sign-up.
        if (await users.findOne({ email })) {
          return fail(res, 'google_email_taken');
        }
        user = await users.create({
          _id: crypto.randomUUID(),
          email,
          name: (profile.name || email.split('@')[0]).slice(0, 80),
          googleId: profile.sub
        });
      }

      res.clearCookie(STATE_COOKIE, { path: stateCookieOptions.path, domain: stateCookieOptions.domain });
      if (relayHost) {
        const jti = crypto.randomBytes(24).toString('base64url');
        await users.updateOne({ _id: user._id }, { $set: { oauthHandoffJti: hashJti(jti) } });
        const token = signStateCookie({
          typ: 'handoff', uid: user._id, jti, slug: saved.slug ?? null, redirect: saved.redirect, exp: Date.now() + HANDOFF_TTL_MS
        });
        return res.redirect(302, `${targetBaseUrl}/api/session/google/complete?token=${encodeURIComponent(token)}`);
      }
      res.cookie(SESSION_COOKIE_NAME, signSessionToken(user), getSessionCookieOptions());
      return res.redirect(302, `${targetBaseUrl}${safeRedirectPath(saved.redirect)}`);
    } catch (err) {
      console.warn('[OAuth Google] Callback failed:', err.message);
      return fail(res, 'google');
    }
  });

  // Relay landing on the cinema (or apex) host: single-use, 60 s, bound to that host.
  router.get('/complete', limiter, async (req, res) => {
    const data = verifyStateCookie(req.query.token);
    if (!relayHost || data?.typ !== 'handoff' || typeof data.uid !== 'string' || typeof data.jti !== 'string'
      || !(data.exp > Date.now()) || (data.slug ?? null) !== (req.tenant?.slug ?? null)) {
      return fail(res, 'google');
    }
    try {
      // Atomic consume: a replayed token (other tab, other worker) finds no matching jti.
      const user = await users.findOneAndUpdate(
        { _id: data.uid, oauthHandoffJti: hashJti(data.jti) },
        { $unset: { oauthHandoffJti: 1 } }
      );
      if (!user) return fail(res, 'google');
      res.cookie(SESSION_COOKIE_NAME, signSessionToken(user), getSessionCookieOptions());
      return res.redirect(302, safeRedirectPath(data.redirect));
    } catch (err) {
      console.warn('[OAuth Google] Handoff failed:', err.message);
      return fail(res, 'google');
    }
  });

  return router;
}

export const googleAuthRouter = createGoogleAuthRouter();
