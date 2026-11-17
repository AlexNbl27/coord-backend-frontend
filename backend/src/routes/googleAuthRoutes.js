import crypto from 'node:crypto';
import { Router } from 'express';
import { Cinema } from '../models/Cinema.js';
import { User } from '../models/User.js';
import {
  SESSION_COOKIE_NAME,
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

export function isGoogleAuthEnabled(env = process.env) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

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
  const appUrl = (env.APP_URL || 'http://cineslot.localhost:3001').replace(/\/$/, '');
  const redirectUri = env.GOOGLE_REDIRECT_URI || `${appUrl}/api/session/google/callback`;
  const stateSecret = env.SESSION_SECRET || 'dev-only-ephemeral-hmac-secret-key-32bytes';
  const cookieDomain = env.SESSION_COOKIE_DOMAIN || '.cineslot.localhost';
  const stateCookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: cookieDomain,
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
    res.clearCookie(STATE_COOKIE, { path: stateCookieOptions.path, domain: cookieDomain });
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
    if (!saved || typeof state !== 'string' || typeof code !== 'string' || state !== saved.state) {
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

      res.clearCookie(STATE_COOKIE, { path: stateCookieOptions.path, domain: cookieDomain });
      res.cookie(SESSION_COOKIE_NAME, signSessionToken(user), getSessionCookieOptions());
      return res.redirect(302, `${targetBaseUrl}${safeRedirectPath(saved.redirect)}`);
    } catch (err) {
      console.warn('[OAuth Google] Callback failed:', err.message);
      return fail(res, 'google');
    }
  });

  return router;
}

export const googleAuthRouter = createGoogleAuthRouter();
