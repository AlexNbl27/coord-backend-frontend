import { Router } from 'express';
import { ReservationLog, RESERVATION_ACTIONS } from '../models/ReservationLog.js';
import { AuditLog } from '../models/AuditLog.js';
import { auditRequest } from '../events/audit.js';
import { buildProblemDetail, requireRole } from '../services/sessionService.js';
import { isValidSlug } from '../tenancy/index.js';
import { isPlainString, isValidEntityId } from '../utils/securityMiddleware.js';

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;
export const MAX_PAGE = 1000;

const RESERVATION_ACTION_SET = new Set(RESERVATION_ACTIONS);
const AUDIT_ACTION_RE = /^[A-Z][A-Z0-9_]{0,63}$/;
const FORBIDDEN = Symbol('forbidden');

class BadQuery extends Error {}

function problem(res, status, title, detail) {
  return res
    .status(status)
    .type('application/problem+json')
    .json(buildProblemDetail(status, title, detail));
}

function readInt(value, fallback, min, max, label) {
  if (value === undefined) {
    return fallback;
  }
  if (!isPlainString(value, 6) || !/^\d+$/.test(value)) {
    throw new BadQuery(`Paramètre ${label} invalide.`);
  }
  const n = Number(value);
  if (n < min || n > max) {
    throw new BadQuery(`Paramètre ${label} hors limites (${min}-${max}).`);
  }
  return n;
}

function readPaging(query) {
  return {
    page: readInt(query.page, 1, 1, MAX_PAGE, 'page'),
    limit: readInt(query.limit, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE, 'limit')
  };
}

function readDateRange(query) {
  const range = {};
  for (const [key, op] of [['from', '$gte'], ['to', '$lte']]) {
    const raw = query[key];
    if (raw === undefined || raw === '') {
      continue;
    }
    const date = isPlainString(raw, 40) ? new Date(raw) : null;
    if (!date || Number.isNaN(date.getTime())) {
      throw new BadQuery(`Paramètre ${key} invalide (date ISO 8601 attendue).`);
    }
    range[op] = date;
  }
  if (range.$gte && range.$lte && range.$gte > range.$lte) {
    throw new BadQuery('La date de début doit précéder la date de fin.');
  }
  return Object.keys(range).length ? range : null;
}

function readOptional(query, key, validate) {
  const raw = query[key];
  if (raw === undefined || raw === '') {
    return null;
  }
  if (!validate(raw)) {
    throw new BadQuery(`Paramètre ${key} invalide.`);
  }
  return raw;
}

function cinemaScope(user, requested) {
  if (user.role === 'SUPER_ADMIN') {
    return requested ?? null;
  }
  const allowed = Array.isArray(user.cinemaSlugs) ? user.cinemaSlugs.filter(isValidSlug) : [];
  if (requested) {
    return allowed.includes(requested) ? requested : FORBIDDEN;
  }
  return { $in: allowed };
}

async function deny(req, res, cinemaSlug) {
  await auditRequest(req, 'ACCESS_DENIED', {
    target: { type: 'logs', id: `${req.method} ${req.baseUrl}${req.path}`, cinemaSlug },
    result: 'DENIED'
  });
  res.locals.deniedAudited = true;
  return problem(res, 403, 'Forbidden', 'Vous n\'avez pas accès aux journaux de ce cinéma.');
}

async function paginate(model, filter, sort, { page, limit }) {
  const [total, items] = await Promise.all([
    model.countDocuments(filter),
    model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean()
  ]);
  return { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)), items };
}

function toReservationLogView(log) {
  return {
    id: String(log._id),
    at: log.at,
    action: log.action,
    cinemaSlug: log.cinemaSlug ?? null,
    slotId: log.slotId ?? null,
    movieId: log.movieId ?? null,
    bookingId: log.bookingId ?? null,
    userId: log.userId ?? null,
    quantity: log.quantity ?? 0,
    traceId: log.traceId ?? null
  };
}

function toAuditView(entry) {
  return {
    seq: entry.seq,
    at: entry.at,
    actor: entry.actor ?? null,
    action: entry.action,
    target: entry.target ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    result: entry.result,
    prevHash: entry.prevHash,
    hash: entry.hash
  };
}

function handle(fn) {
  return async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      return await fn(req, res);
    } catch (err) {
      if (err instanceof BadQuery) {
        return problem(res, 400, 'Bad Request', err.message);
      }
      return next(err);
    }
  };
}

export function createAdminLogRouter({ reservationLogs = ReservationLog, auditLogs = AuditLog } = {}) {
  const router = Router();
  const adminOnly = requireRole('SUPER_ADMIN', 'CINEMA_ADMIN');

  router.get('/logs/reservations', adminOnly, handle(async (req, res) => {
    const paging = readPaging(req.query);
    const cinema = readOptional(req.query, 'cinema', isValidSlug);
    const movie = readOptional(req.query, 'movie', isValidEntityId);
    const slot = readOptional(req.query, 'slot', isValidEntityId);
    const action = readOptional(req.query, 'action', (v) => RESERVATION_ACTION_SET.has(v));
    const at = readDateRange(req.query);

    const scope = cinemaScope(req.sessionUser, cinema);
    if (scope === FORBIDDEN) {
      return deny(req, res, cinema);
    }
    const filter = {};
    if (scope) filter.cinemaSlug = scope;
    if (movie) filter.movieId = movie;
    if (slot) filter.slotId = slot;
    if (action) filter.action = action;
    if (at) filter.at = at;

    const result = await paginate(reservationLogs, filter, { at: -1, _id: -1 }, paging);
    return res.json({ ...result, items: result.items.map(toReservationLogView) });
  }));

  router.get('/audit', adminOnly, handle(async (req, res) => {
    const paging = readPaging(req.query);
    const cinema = readOptional(req.query, 'cinema', isValidSlug);
    const action = readOptional(req.query, 'action', (v) => isPlainString(v, 64) && AUDIT_ACTION_RE.test(v));
    const at = readDateRange(req.query);

    const scope = cinemaScope(req.sessionUser, cinema);
    if (scope === FORBIDDEN) {
      return deny(req, res, cinema);
    }
    const filter = {};
    if (scope) filter['target.cinemaSlug'] = scope;
    if (action) filter.action = action;
    if (at) filter.at = at;

    const result = await paginate(auditLogs, filter, { seq: -1 }, paging);
    return res.json({ ...result, items: result.items.map(toAuditView) });
  }));

  return router;
}

export const adminLogRouter = createAdminLogRouter();
