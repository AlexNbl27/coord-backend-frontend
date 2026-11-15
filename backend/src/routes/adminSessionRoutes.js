import crypto from 'node:crypto';
import { Router } from 'express';
import { User } from '../models/User.js';
import {
  ADMIN_COOKIE_NAME,
  MFA_STEP_UP_TTL_MS,
  getAdminCookieOptions,
  hashPassword,
  requireRole,
  sendProblem as problem,
  signAdminSessionToken,
  toPublicUser,
  verifyPassword
} from '../services/sessionService.js';
import {
  buildTotpUri,
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpSecret,
  verifyTotpCode
} from '../services/totpService.js';
import { createRateLimiter, isPlainString } from '../utils/securityMiddleware.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DUMMY_HASH_PROMISE = hashPassword(crypto.randomBytes(16).toString('hex'));

function readEmail(value) {
  return isPlainString(value, 254) && EMAIL_RE.test(value.trim()) ? value.trim().toLowerCase() : null;
}

export function createAdminSessionRouter(deps = {}) {
  const users = deps.users || User;
  const router = Router();
  const authLimiter = deps.authLimiter || createRateLimiter({ windowMs: 15 * 60_000, max: 20 });
  const loginLimiter = deps.loginLimiter || createRateLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    keyFn: (req) => `admin:${readEmail(req.body?.email) ?? req.ip}`
  });
  const mfaLimiter = deps.mfaLimiter || createRateLimiter({
    windowMs: 15 * 60_000,
    max: 10,
    keyFn: (req) => `mfa:${req.sessionUser?.id ?? req.ip}`
  });

  router.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      authenticated: Boolean(req.sessionUser),
      user: req.sessionUser ?? null,
      // lets the login page ask only for the TOTP code after a reload (setup vs. verify)
      mfaEnabled: req.adminSession?.mfaEnabled ?? false,
      mfaVerifiedAt: req.adminSession?.mfaVerifiedAt ?? null
    });
  });

  router.post('/login', authLimiter, loginLimiter, async (req, res, next) => {
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
      if (!['SUPER_ADMIN', 'CINEMA_ADMIN'].includes(user.role)) {
        return problem(res, 403, 'Forbidden', 'Accès réservé aux administrateurs.');
      }

      let mfaVerifiedAt = null;
      const totpCode = req.body?.totpCode;
      if (user.totpEnabled && user.totpSecretEncrypted && typeof totpCode === 'string') {
        const secret = decryptTotpSecret(user.totpSecretEncrypted);
        if (!secret || !verifyTotpCode(secret, totpCode)) {
          return problem(res, 401, 'Unauthorized', 'Code MFA invalide.');
        }
        mfaVerifiedAt = Date.now();
      }

      const token = signAdminSessionToken(user, { mfaVerifiedAt });
      res.cookie(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
      return res.json({
        authenticated: true,
        user: toPublicUser(user),
        mfaEnabled: Boolean(user.totpEnabled),
        mfaVerifiedAt
      });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/mfa/setup', authLimiter, requireRole('SUPER_ADMIN', 'CINEMA_ADMIN'), async (req, res, next) => {
    try {
      const existingQuery = users.findOne({ _id: req.sessionUser.id }, 'totpEnabled');
      const existing = typeof existingQuery?.lean === 'function' ? await existingQuery.lean() : await existingQuery;
      if (existing?.totpEnabled) {
        const verifiedAt = req.adminSession?.mfaVerifiedAt;
        if (typeof verifiedAt !== 'number' || Date.now() - verifiedAt > MFA_STEP_UP_TTL_MS) {
          return problem(res, 403, 'Forbidden', 'Vérification MFA récente requise pour reconfigurer le MFA.');
        }
      }
      const secret = generateTotpSecret();
      const encrypted = encryptTotpSecret(secret);
      await users.findOneAndUpdate(
        { _id: req.sessionUser.id },
        { $set: { totpSecretEncrypted: encrypted, totpEnabled: false } }
      );
      return res.json({
        secret,
        otpauthUri: buildTotpUri(secret, req.sessionUser.email)
      });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/mfa/verify', authLimiter, mfaLimiter, requireRole('SUPER_ADMIN', 'CINEMA_ADMIN'), async (req, res, next) => {
    try {
      const code = req.body?.code;
      const query = users.findOne({ _id: req.sessionUser.id }, 'totpSecretEncrypted totpEnabled sessionVersion name email role');
      const dbUser = typeof query?.lean === 'function' ? await query.lean() : await query;
      if (!dbUser?.totpSecretEncrypted) {
        return problem(res, 400, 'Bad Request', 'MFA TOTP non configuré.');
      }
      const secret = decryptTotpSecret(dbUser.totpSecretEncrypted);
      if (!secret || !verifyTotpCode(secret, code)) {
        return problem(res, 403, 'Forbidden', 'Code MFA invalide.');
      }
      if (!dbUser.totpEnabled) {
        await users.findOneAndUpdate(
          { _id: req.sessionUser.id },
          { $set: { totpEnabled: true } }
        );
      }
      const now = Date.now();
      const token = signAdminSessionToken(
        {
          _id: req.sessionUser.id,
          name: req.sessionUser.name,
          email: req.sessionUser.email,
          sessionVersion: dbUser.sessionVersion ?? 0
        },
        {
          iat: req.adminSession?.iat ?? now,
          now,
          mfaVerifiedAt: now
        }
      );
      res.cookie(ADMIN_COOKIE_NAME, token, getAdminCookieOptions());
      return res.json({ mfaVerifiedAt: now });
    } catch (err) {
      return next(err);
    }
  });

  router.post('/logout', async (req, res, next) => {
    try {
      if (req.sessionUser?.id) {
        await users.findOneAndUpdate(
          { _id: req.sessionUser.id },
          { $inc: { sessionVersion: 1 } }
        );
      }
      res.clearCookie(ADMIN_COOKIE_NAME, { path: '/' });
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export const adminSessionRouter = createAdminSessionRouter();
