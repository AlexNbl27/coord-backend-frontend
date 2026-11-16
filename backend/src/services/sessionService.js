import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { User } from '../models/User.js';

const scrypt = promisify(crypto.scrypt);

export const SESSION_COOKIE_NAME = 'cineslot_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('SESSION_SECRET environment variable is required in production'); })()
    : 'dev-only-ephemeral-hmac-secret-key-32bytes'
);

const SCRYPT_KEYLEN = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `${salt.toString('base64url')}:${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') {
    return false;
  }
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) {
    return false;
  }
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64url'), expected.length);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

export function toPublicUser(user) {
  return { id: user._id ?? user.id, name: user.name, email: user.email };
}

// name/email are copied into the cookie: re-read the user from DB if profile editing is ever added.
// ver = user's sessionVersion: bumping it in DB revokes every session signed before.
export function signSessionToken(user, ttlMs = SESSION_MAX_AGE_MS) {
  const exp = Date.now() + ttlMs;
  const claims = { sub: String(user._id ?? user.id), name: user.name, email: user.email, ver: user.sessionVersion ?? 0, exp };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') {
    return null;
  }
  const dotIndex = token.indexOf('.');
  if (dotIndex <= 0) {
    return null;
  }

  const payload = token.slice(0, dotIndex);
  const providedSig = token.slice(dotIndex + 1);
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');

  const providedBuf = Buffer.from(providedSig, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (providedBuf.length !== expectedBuf.length) {
    return null;
  }
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  const decoded = Buffer.from(payload, 'base64url').toString('utf8');
  try {
    const parsed = JSON.parse(decoded);
    if (!parsed || typeof parsed.sub !== 'string' || typeof parsed.exp !== 'number') {
      return null;
    }
    if (Date.now() > parsed.exp) {
      return null;
    }
    return { id: parsed.sub, name: parsed.name, email: parsed.email, ver: Number.isInteger(parsed.ver) ? parsed.ver : 0 };
  } catch {
    return null;
  }
}

export function buildProblemDetail(status, title, detail) {
  return {
    type: 'about:blank',
    title,
    status,
    detail,
    message: detail
  };
}

/**
 * Reads the session cookie and checks in DB that the account still exists
 * and that its sessions were not revoked (password reset).
 */
export function createAttachSession(users = User) {
  return async function attachSession(req, _res, next) {
    req.sessionUser = null;
    const claims = verifySessionToken(req.cookies?.[SESSION_COOKIE_NAME]);
    if (!claims) {
      return next();
    }
    try {
      const { ver, ...user } = claims;
      // null also matches a missing field, i.e. version 0.
      if (await users.exists({ _id: user.id, sessionVersion: ver || null })) {
        req.sessionUser = user;
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

export const attachSession = createAttachSession();

export function requireSession(req, res, next) {
  if (!req.sessionUser) {
    return res
      .status(401)
      .type('application/problem+json')
      .json(buildProblemDetail(401, 'Unauthorized', 'Votre session a expiré. Reconnectez-vous.'));
  }
  return next();
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api',
    maxAge: SESSION_MAX_AGE_MS
  };
}
