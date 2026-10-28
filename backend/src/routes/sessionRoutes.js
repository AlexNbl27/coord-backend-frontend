import crypto from 'node:crypto';
import { Router } from 'express';
import { User } from '../models/User.js';
import { sendPasswordResetEmail } from '../services/mailService.js';
import {
  SESSION_COOKIE_NAME,
  buildProblemDetail,
  getSessionCookieOptions,
  hashPassword,
  hashResetToken,
  signSessionToken,
  toPublicUser,
  verifyPassword
} from '../services/sessionService.js';
import { createRateLimiter, isPlainString } from '../utils/securityMiddleware.js';
import { isGoogleAuthEnabled } from './googleAuthRoutes.js';

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APP_URL = (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
// Used when the email is unknown so that login timing does not leak existing accounts.
const DUMMY_HASH_PROMISE = hashPassword(crypto.randomBytes(16).toString('hex'));

function problem(res, status, title, detail) {
  return res
    .status(status)
    .type('application/problem+json')
    .json(buildProblemDetail(status, title, detail));
}

function readEmail(value) {
  return isPlainString(value, 254) && EMAIL_RE.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function isValidPassword(value) {
  return isPlainString(value, 128) && value.length >= 8;
}

function openSession(res, user) {
  const publicUser = toPublicUser(user);
  res.cookie(SESSION_COOKIE_NAME, signSessionToken(publicUser), getSessionCookieOptions());
  return publicUser;
}

/**
 * Creates the session router (injectable user store and mailer for unit tests).
 */
export function createSessionRouter(deps = {}) {
  const users = deps.users || User;
  const sendResetEmail = deps.sendPasswordResetEmail || sendPasswordResetEmail;
  const router = Router();
  const authLimiter = deps.authLimiter || createRateLimiter({ windowMs: 15 * 60_000, max: 20 });

  /**
   * GET /api/session
   * Returns the current authenticated spectator.
   */
  router.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      authenticated: Boolean(req.sessionUser),
      user: req.sessionUser ?? null,
      googleEnabled: isGoogleAuthEnabled()
    });
  });

  /**
   * POST /api/session/register
   * Creates an account and opens a session.
   */
  router.post('/register', authLimiter, async (req, res, next) => {
    try {
      const email = readEmail(req.body?.email);
      const rawName = req.body?.name;
      const password = req.body?.password;
      if (!email) {
        return problem(res, 400, 'Bad Request', 'Adresse email invalide.');
      }
      if (!isPlainString(rawName, 80) || !rawName.trim()) {
        return problem(res, 400, 'Bad Request', 'Le nom est obligatoire (80 caractères maximum).');
      }
      if (!isValidPassword(password)) {
        return problem(res, 400, 'Bad Request', 'Le mot de passe doit contenir entre 8 et 128 caractères.');
      }

      const user = await users.create({
        _id: crypto.randomUUID(),
        email,
        name: rawName.trim(),
        passwordHash: await hashPassword(password)
      });
      return res.status(201).json({ authenticated: true, user: openSession(res, user) });
    } catch (err) {
      if (err?.code === 11000) {
        return problem(res, 409, 'Conflict', 'Un compte existe déjà avec cette adresse email.');
      }
      return next(err);
    }
  });

  /**
   * POST /api/session/login
   * Checks email + password and sets an HttpOnly SameSite=Lax cookie.
   */
  router.post('/login', authLimiter, async (req, res, next) => {
    try {
      const email = readEmail(req.body?.email);
      const password = req.body?.password;
      const user = email && isPlainString(password, 128) ? await users.findOne({ email }) : null;
      const ok = await verifyPassword(
        isPlainString(password, 128) ? password : '',
        user?.passwordHash ?? await DUMMY_HASH_PROMISE
      );
      if (!user || !ok) {
        return problem(res, 401, 'Unauthorized', 'Email ou mot de passe incorrect.');
      }
      return res.json({ authenticated: true, user: openSession(res, user) });
    } catch (err) {
      return next(err);
    }
  });

  /**
   * POST /api/session/logout
   * Clears the spectator session cookie.
   */
  router.post('/logout', (_req, res) => {
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/api' });
    return res.status(204).end();
  });

  /**
   * POST /api/session/forgot-password
   * Always 204, whether the account exists or not (no account enumeration).
   */
  router.post('/forgot-password', authLimiter, async (req, res, next) => {
    try {
      const email = readEmail(req.body?.email);
      if (email) {
        const token = crypto.randomBytes(32).toString('base64url');
        const user = await users.findOneAndUpdate(
          { email },
          { $set: { resetTokenHash: hashResetToken(token), resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS) } }
        );
        if (user) {
          // Fire and forget: same response time whether the account exists or not.
          Promise.resolve()
            .then(() => sendResetEmail(user.email, `${APP_URL}/reset-password?token=${token}`))
            .catch((err) => console.warn('[Mail] Reset email delivery failed:', err.message));
        }
      }
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  /**
   * POST /api/session/reset-password
   * Sets a new password from a single-use reset token.
   * Note: sessions opened before the reset stay valid until their cookie expires.
   */
  router.post('/reset-password', authLimiter, async (req, res, next) => {
    try {
      const token = req.body?.token;
      const password = req.body?.password;
      if (!isValidPassword(password)) {
        return problem(res, 400, 'Bad Request', 'Le mot de passe doit contenir entre 8 et 128 caractères.');
      }
      if (!isPlainString(token, 128) || !token) {
        return problem(res, 400, 'Bad Request', 'Lien invalide ou expiré.');
      }
      const user = await users.findOneAndUpdate(
        { resetTokenHash: hashResetToken(token), resetTokenExpires: { $gt: new Date() } },
        {
          $set: { passwordHash: await hashPassword(password) },
          $unset: { resetTokenHash: 1, resetTokenExpires: 1 }
        }
      );
      if (!user) {
        return problem(res, 400, 'Bad Request', 'Lien invalide ou expiré.');
      }
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export const sessionRouter = createSessionRouter();
