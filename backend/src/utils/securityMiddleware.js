import mongoose from 'mongoose';

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
  );
  next();
}

export function createRateLimiter({ windowMs = 60_000, max = 300 } = {}) {
  const hits = new Map();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits.entries()) {
      if (now > entry.resetAt) {
        hits.delete(key);
      }
    }
  }, windowMs);
  cleanup.unref?.();

  return function rateLimiter(req, res, next) {
    if (process.env.RATE_LIMIT_ENABLED === 'false') {
      return next();
    }
    const effectiveMax = Number(process.env.RATE_LIMIT_MAX) || max;
    const now = Date.now();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    let entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;
    res.setHeader('X-RateLimit-Limit', String(effectiveMax));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, effectiveMax - entry.count)));

    if (entry.count > effectiveMax) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({
        message: 'Trop de requêtes. Veuillez patienter avant de réessayer.'
      });
    }

    return next();
  };
}

export function isPlainString(value, maxLength = 200) {
  return typeof value === 'string' && value.length <= maxLength;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function isValidObjectId(id) {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

export function isValidEntityId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

export function sanitizeMoviePayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }
  const allowed = {};
  if (typeof body.title === 'string') allowed.title = body.title.trim().slice(0, 200);
  if (typeof body.director === 'string') allowed.director = body.director.trim().slice(0, 150);
  if (typeof body.year === 'number' && Number.isFinite(body.year)) allowed.year = body.year;
  if (Array.isArray(body.genres)) {
    allowed.genres = body.genres.filter((g) => typeof g === 'string').map((g) => g.trim().slice(0, 50));
  }
  if (typeof body.duration === 'number' && Number.isFinite(body.duration)) allowed.duration = body.duration;
  if (body.ratings && typeof body.ratings === 'object' && !Array.isArray(body.ratings)) {
    allowed.ratings = {};
    if (typeof body.ratings.imdb === 'number') allowed.ratings.imdb = body.ratings.imdb;
    if (typeof body.ratings.rottenTomatoes === 'number') allowed.ratings.rottenTomatoes = body.ratings.rottenTomatoes;
    if (typeof body.ratings.votes === 'number') allowed.ratings.votes = body.ratings.votes;
  }
  if (Array.isArray(body.cast)) {
    allowed.cast = body.cast.filter((c) => typeof c === 'string').map((c) => c.trim().slice(0, 100));
  }
  if (typeof body.budget === 'number' && Number.isFinite(body.budget)) allowed.budget = body.budget;
  if (typeof body.boxOffice === 'number' && Number.isFinite(body.boxOffice)) allowed.boxOffice = body.boxOffice;
  if (typeof body.availableOnStreaming === 'boolean') allowed.availableOnStreaming = body.availableOnStreaming;
  if (Array.isArray(body.tags)) {
    allowed.tags = body.tags.filter((t) => typeof t === 'string').map((t) => t.trim().slice(0, 50));
  }
  if (typeof body.synopsis === 'string') allowed.synopsis = body.synopsis.slice(0, 2000);
  if (typeof body.poster === 'string' && /^https?:\/\//i.test(body.poster)) {
    allowed.poster = body.poster.slice(0, 500);
  }
  return allowed;
}
