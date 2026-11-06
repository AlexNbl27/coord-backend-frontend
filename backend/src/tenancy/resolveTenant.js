import { sendProblem } from '../services/sessionService.js';
import { getCinemaStatus } from '../services/cinemaStatusService.js';
import { isValidSlug } from './slug.js';
import { useTenantDb } from './models.js';

export const DEFAULT_BASE_DOMAIN = 'cineslot.localhost';
export const ADMIN_LABEL = 'admin';

function escapeForRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function parseHost(rawHost, baseDomain = DEFAULT_BASE_DOMAIN) {
  if (typeof rawHost !== 'string') return null;
  const host = rawHost.trim().toLowerCase();
  const base = escapeForRegex(baseDomain.toLowerCase());
  const match = new RegExp(`^(?:([a-z0-9-]{1,63})\\.)?${base}(?::\\d{1,5})?$`).exec(host);
  if (!match) return null;
  return { label: match[1] ?? null };
}

export function createResolveTenant({
  baseDomain = process.env.TENANT_BASE_DOMAIN || DEFAULT_BASE_DOMAIN,
  getStatus = getCinemaStatus,
  getDb = useTenantDb
} = {}) {
  return async function resolveTenant(req, res, next) {
    req.plane = null;
    req.tenant = null;

    const parsed = parseHost(req.headers.host, baseDomain);
    if (!parsed) {
      return sendProblem(res, 421, 'Misdirected Request', 'Hôte non servi par cette application.');
    }

    if (parsed.label === null) {
      req.plane = 'public';
      return next();
    }

    if (parsed.label === ADMIN_LABEL) {
      req.plane = 'admin';
      return next();
    }

    if (!isValidSlug(parsed.label)) {
      return sendProblem(res, 404, 'Not Found', 'Cinéma introuvable.');
    }

    let status;
    try {
      status = await getStatus(parsed.label);
    } catch (err) {
      return next(err);
    }

    if (!status) return sendProblem(res, 404, 'Not Found', 'Cinéma introuvable.');
    if (status === 'DELETED') return sendProblem(res, 410, 'Gone', 'Ce cinéma a été supprimé.');

    req.plane = 'tenant';
    req.tenant = { slug: parsed.label, status, db: getDb(parsed.label) };
    return next();
  };
}

export const resolveTenant = createResolveTenant();

export function requireTenant(req, res, next) {
  if (!req.tenant?.db) {
    return sendProblem(res, 404, 'Not Found', 'Aucun cinéma ne correspond à cette adresse.');
  }
  return next();
}
