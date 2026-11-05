import { buildProblemDetail } from '../services/sessionService.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function originHost(origin) {
  if (typeof origin !== 'string' || origin === 'null') {
    return null;
  }
  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

export function isSameHostOrigin(origin, host) {
  const fromOrigin = originHost(origin);
  return fromOrigin !== null && typeof host === 'string' && fromOrigin === host.trim().toLowerCase();
}

export function createCrossOriginWriteGuard(allowedOrigins = new Set()) {
  return function crossOriginWriteGuard(req, res, next) {
    if (SAFE_METHODS.has(req.method)) {
      return next();
    }
    const origin = req.headers.origin;
    if (origin === undefined) {
      return next();
    }
    if (isSameHostOrigin(origin, req.headers.host) || allowedOrigins.has(origin)) {
      return next();
    }
    return res
      .status(403)
      .type('application/problem+json')
      .json(buildProblemDetail(403, 'Forbidden', 'Origine de la requête non autorisée pour cet hôte.'));
  };
}
