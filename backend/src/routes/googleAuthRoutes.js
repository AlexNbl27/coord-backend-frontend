import crypto from 'node:crypto';
import { Router } from 'express';
import { User } from '../models/User.js';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  signSessionToken,
  toPublicUser
} from '../services/sessionService.js';
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
  const fetchImpl = deps.fetch || fetch;
  const appUrl = (env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
  const redirectUri = env.GOOGLE_REDIRECT_URI || `${appUrl}/api/session/google/callback`;
  const stateCookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/session/google',
    maxAge: STATE_TTL_MS
  };
  const router = Router();
  const limiter = deps.limiter || createRateLimiter({ windowMs: 15 * 60_000, max: 30 });

  const fail = (res, reason) => {
    res.clearCookie(STATE_COOKIE, { path: stateCookieOptions.path });
    return res.redirect(302, `${appUrl}/login?error=${reason}`);
  };

  router.use((req, res, next) => (isGoogleAuthEnabled(env) ? next() : res.status(404).end()));

  /**
   * GET /api/session/google?redirect=/path
   * Redirects the browser to Google's consent screen.
   */
  router.get('/', limiter, (req, res) => {
    const state = crypto.randomBytes(24).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    const redirect = safeRedirectPath(req.query.redirect);

    res.cookie(STATE_COOKIE, JSON.stringify({ state, verifier, redirect }), stateCookieOptions);
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

  /**
   * GET /api/session/google/callback?code=…&state=…
   * Exchanges the code, finds or creates the user, opens the session.
   */
  router.get('/callback', limiter, async (req, res) => {
    let saved;
    try {
      saved = JSON.parse(req.cookies?.[STATE_COOKIE] || 'null');
    } catch {
      saved = null;
    }
    const { code, state } = req.query;
    if (!saved || typeof state !== 'string' || typeof code !== 'string' || state !== saved.state) {
      return fail(res, 'google');
    }

    try {
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

      res.clearCookie(STATE_COOKIE, { path: stateCookieOptions.path });
      res.cookie(SESSION_COOKIE_NAME, signSessionToken(toPublicUser(user)), getSessionCookieOptions());
      return res.redirect(302, `${appUrl}${safeRedirectPath(saved.redirect)}`);
    } catch (err) {
      console.warn('[OAuth Google] Callback failed:', err.message);
      return fail(res, 'google');
    }
  });

  return router;
}

export const googleAuthRouter = createGoogleAuthRouter();
