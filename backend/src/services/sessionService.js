import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'cineslot_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_SECRET = process.env.SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('SESSION_SECRET environment variable is required in production'); })()
    : 'dev-only-ephemeral-hmac-secret-key-32bytes'
);

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

export function findSpectatorById(userId) {
  if (!userId || typeof userId !== 'string') {
    return null;
  }
  return SPECTATOR_MAP.get(userId) ?? null;
}

export function signSessionToken(userId, ttlMs = SESSION_MAX_AGE_MS) {
  const exp = Date.now() + ttlMs;
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp }), 'utf8').toString('base64url');
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
    return findSpectatorById(parsed.sub);
  } catch {
    return findSpectatorById(decoded);
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

export function attachSession(req, _res, next) {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  req.sessionUser = verifySessionToken(token);
  next();
}

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
