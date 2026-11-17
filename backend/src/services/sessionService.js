import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { User } from '../models/User.js';

const scrypt = promisify(crypto.scrypt);

export const SESSION_COOKIE_NAME = 'cineslot_session';
export const ADMIN_COOKIE_NAME = '__Host-cineslot_admin';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const ADMIN_SLIDING_TTL_MS = 30 * 60 * 1000;
export const ADMIN_ABSOLUTE_TTL_MS = 8 * 60 * 60 * 1000;
export const MFA_STEP_UP_TTL_MS = 5 * 60 * 1000;
const MIN_SECRET_LENGTH = 32;
const SESSION_SECRET = process.env.SESSION_SECRET
  || (process.env.NODE_ENV === 'test' ? 'dev-only-ephemeral-hmac-secret-key-32bytes' : '');
if (SESSION_SECRET.length < MIN_SECRET_LENGTH) {
  throw new Error(`SESSION_SECRET must be set and at least ${MIN_SECRET_LENGTH} characters long`);
}

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 256 * 1024 * 1024;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM
  });
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || typeof stored !== 'string') {
    return false;
  }
  if (stored.startsWith('scrypt$')) {
    const parts = stored.split('$');
    if (parts.length !== 4) {
      return false;
    }
    const [, paramStr, saltB64, hashB64] = parts;
    if (!paramStr || !saltB64 || !hashB64) {
      return false;
    }
    const params = Object.fromEntries(paramStr.split(',').map((kv) => kv.split('=')));
    const N = Number(params.N);
    const r = Number(params.r);
    const p = Number(params.p);
    if (!Number.isInteger(N) || N < 1024 || !Number.isInteger(r) || r < 1 || !Number.isInteger(p) || p < 1) {
      return false;
    }
    try {
      const salt = Buffer.from(saltB64, 'base64url');
      const expected = Buffer.from(hashB64, 'base64url');
      if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) {
        return false;
      }
      const actual = await scrypt(password, salt, SCRYPT_KEYLEN, {
        N,
        r,
        p,
        maxmem: Math.max(32 * 1024 * 1024, 256 * N * r)
      });
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }
  const [saltB64, hashB64] = stored.split(':');
  if (!saltB64 || !hashB64) {
    return false;
  }
  try {
    const salt = Buffer.from(saltB64, 'base64url');
    const expected = Buffer.from(hashB64, 'base64url');
    if (salt.length === 0 || expected.length !== SCRYPT_KEYLEN) {
      return false;
    }
    const actual = await scrypt(password, salt, SCRYPT_KEYLEN);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('base64url');
}

export function toPublicUser(user) {
  return {
    id: user._id ?? user.id,
    name: user.name,
    email: user.email,
    role: user.role ?? 'SPECTATOR'
  };
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

export function signAdminSessionToken(user, { iat = Date.now(), now = Date.now(), mfaVerifiedAt = null } = {}) {
  const absExp = iat + ADMIN_ABSOLUTE_TTL_MS;
  const exp = Math.min(now + ADMIN_SLIDING_TTL_MS, absExp);
  const claims = {
    sub: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    ver: user.sessionVersion ?? 0,
    aud: 'admin',
    iat,
    absExp,
    exp,
    mfaVerifiedAt
  };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

export function verifyAdminSessionToken(token, now = Date.now()) {
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
  if (providedBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (
      !parsed
      || typeof parsed.sub !== 'string'
      || parsed.aud !== 'admin'
      || typeof parsed.exp !== 'number'
      || typeof parsed.absExp !== 'number'
    ) {
      return null;
    }
    if (now > parsed.exp || now > parsed.absExp) {
      return null;
    }
    return {
      id: parsed.sub,
      name: parsed.name,
      email: parsed.email,
      ver: Number.isInteger(parsed.ver) ? parsed.ver : 0,
      iat: parsed.iat,
      absExp: parsed.absExp,
      mfaVerifiedAt: typeof parsed.mfaVerifiedAt === 'number' ? parsed.mfaVerifiedAt : null
    };
  } catch {
    return null;
  }
}

export function rejectDuplicateSessionCookies(req, res, next) {
  const raw = req.headers?.cookie;
  if (typeof raw === 'string' && raw.length > 0) {
    let spectatorCount = 0;
    let adminCount = 0;
    for (const part of raw.split(';')) {
      const trimmed = part.trim();
      if (trimmed.startsWith(`${SESSION_COOKIE_NAME}=`)) {
        spectatorCount += 1;
      } else if (trimmed.startsWith(`${ADMIN_COOKIE_NAME}=`)) {
        adminCount += 1;
      }
      if (spectatorCount > 1 || adminCount > 1) {
        return res
          .status(400)
          .type('application/problem+json')
          .json(buildProblemDetail(400, 'Bad Request', 'En-tête Cookie invalide : cookie de session dupliqué.'));
      }
    }
  }
  return next();
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

export function sendProblem(res, status, title, detail) {
  return res
    .status(status)
    .type('application/problem+json')
    .json(buildProblemDetail(status, title, detail));
}

/**
 * Reads the session cookie and checks in DB that the account still exists
 * and that its sessions were not revoked (password reset).
 */
export function createAttachSession(users = User) {
  return async function attachSession(req, res, next) {
    req.sessionUser = null;
    req.adminSession = null;

    if (req.plane === 'admin') {
      const adminClaims = verifyAdminSessionToken(req.cookies?.[ADMIN_COOKIE_NAME]);
      if (!adminClaims) {
        return next();
      }
      try {
        const { ver, iat, absExp, mfaVerifiedAt, ...user } = adminClaims;
        const query = users.findOne({ _id: user.id }, 'role cinemaSlugs sessionVersion');
        const dbUser = typeof query?.lean === 'function' ? await query.lean() : await query;
        if (dbUser && (dbUser.sessionVersion ?? 0) === ver) {
          req.sessionUser = {
            ...user,
            role: dbUser.role ?? 'SPECTATOR',
            cinemaSlugs: Array.isArray(dbUser.cinemaSlugs) ? dbUser.cinemaSlugs : []
          };
          req.adminSession = { iat, absExp, mfaVerifiedAt };
          const now = Date.now();
          if (now < absExp && typeof res.cookie === 'function') {
            const refreshed = signAdminSessionToken(
              { _id: user.id, name: user.name, email: user.email, sessionVersion: ver },
              { iat, now, mfaVerifiedAt }
            );
            res.cookie(ADMIN_COOKIE_NAME, refreshed, getAdminCookieOptions(Math.min(ADMIN_SLIDING_TTL_MS, absExp - now)));
          }
        }
        return next();
      } catch (err) {
        return next(err);
      }
    }

    const claims = verifySessionToken(req.cookies?.[SESSION_COOKIE_NAME]);
    if (!claims) {
      return next();
    }
    try {
      const { ver, ...user } = claims;
      const query = users.findOne({ _id: user.id }, 'role cinemaSlugs sessionVersion');
      const dbUser = typeof query?.lean === 'function' ? await query.lean() : await query;
      if (dbUser && (dbUser.sessionVersion ?? 0) === ver) {
        req.sessionUser = {
          ...user,
          role: dbUser.role ?? 'SPECTATOR',
          cinemaSlugs: Array.isArray(dbUser.cinemaSlugs) ? dbUser.cinemaSlugs : []
        };
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

export function requireRole(...roles) {
  return function roleMiddleware(req, res, next) {
    if (!req.sessionUser) {
      return res
        .status(401)
        .type('application/problem+json')
        .json(buildProblemDetail(401, 'Unauthorized', 'Votre session a expiré. Reconnectez-vous.'));
    }
    if (!roles.includes(req.sessionUser.role)) {
      return res
        .status(403)
        .type('application/problem+json')
        .json(buildProblemDetail(403, 'Forbidden', 'Accès refusé.'));
    }
    return next();
  };
}

export function requireTenantAccess(req, res, next) {
  if (!req.sessionUser) {
    return res
      .status(401)
      .type('application/problem+json')
      .json(buildProblemDetail(401, 'Unauthorized', 'Votre session a expiré. Reconnectez-vous.'));
  }
  if (req.sessionUser.role === 'SUPER_ADMIN') {
    return next();
  }
  if (
    req.sessionUser.role === 'CINEMA_ADMIN'
    && req.tenant?.slug
    && Array.isArray(req.sessionUser.cinemaSlugs)
    && req.sessionUser.cinemaSlugs.includes(req.tenant.slug)
  ) {
    return next();
  }
  return res
    .status(403)
    .type('application/problem+json')
    .json(buildProblemDetail(403, 'Forbidden', 'Accès refusé pour ce cinéma.'));
}

export function requireRecentMfa(maxAgeMs = MFA_STEP_UP_TTL_MS) {
  return function mfaMiddleware(req, res, next) {
    if (!req.sessionUser) {
      return res
        .status(401)
        .type('application/problem+json')
        .json(buildProblemDetail(401, 'Unauthorized', 'Votre session a expiré. Reconnectez-vous.'));
    }
    const verifiedAt = req.adminSession?.mfaVerifiedAt;
    if (typeof verifiedAt !== 'number' || Date.now() - verifiedAt > maxAgeMs) {
      return res
        .status(403)
        .type('application/problem+json')
        .json(buildProblemDetail(403, 'Forbidden', 'Vérification MFA récente requise.'));
    }
    return next();
  };
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    domain: process.env.SESSION_COOKIE_DOMAIN || '.cineslot.localhost',
    path: '/api',
    maxAge: SESSION_MAX_AGE_MS
  };
}

export function getAdminCookieOptions(maxAge = ADMIN_SLIDING_TTL_MS) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge
  };
}
