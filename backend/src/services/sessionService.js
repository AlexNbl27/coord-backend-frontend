import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'cineslot_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'cineslot-dev-session-secret-2026';

export const DEMO_SPECTATORS = Object.freeze([
  {
    id: 'spectator-1',
    name: 'Hélène Durand',
    email: 'helene.durand@cineslot.test'
  },
  {
    id: 'spectator-2',
    name: 'Lucas Martin',
    email: 'lucas.martin@cineslot.test'
  }
]);

const SPECTATOR_MAP = new Map(DEMO_SPECTATORS.map((u) => [u.id, u]));

/**
 * Finds a demo spectator by ID.
 */
export function findSpectatorById(userId) {
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  return SPECTATOR_MAP.get(userId) ?? null;
}

/**
 * Signs a spectator session token using HMAC-SHA256.
 */
export function signSessionToken(userId) {
  const payload = Buffer.from(userId, 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Verifies a signed session token and returns the corresponding spectator or null.
 */
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

  const userId = Buffer.from(payload, 'base64url').toString('utf8');
  return findSpectatorById(userId);
}

/**
 * Builds RFC 9457 ProblemDetail payload for error responses.
 */
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
 * Middleware that attaches req.sessionUser when a valid session cookie is present.
 */
export function attachSession(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  req.sessionUser = verifySessionToken(token);
  next();
}

/**
 * Middleware that requires an authenticated spectator session (401 ProblemDetail otherwise).
 */
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
    sameSite: 'lax',
    path: '/api',
    maxAge: SESSION_MAX_AGE_MS
  };
}
