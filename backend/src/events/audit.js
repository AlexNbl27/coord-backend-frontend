import crypto from 'node:crypto';
import { AuditLog } from '../models/AuditLog.js';
import { buildProblemDetail } from '../services/sessionService.js';
import { isValidSlug } from '../tenancy/index.js';

export const AUDIT_GENESIS_HASH = '0'.repeat(64);
const DEV_AUDIT_KEY = 'dev-only-audit-hmac-key-distinct-from-session';
const MAX_APPEND_ATTEMPTS = 8;

export function resolveAuditKey(env = process.env) {
  const key = env.AUDIT_KEY;
  if (!key) {
    if (env.NODE_ENV === 'production') {
      throw new Error('AUDIT_KEY environment variable is required in production');
    }
    return DEV_AUDIT_KEY;
  }
  if (env.SESSION_SECRET && key === env.SESSION_SECRET) {
    throw new Error('AUDIT_KEY must be distinct from SESSION_SECRET');
  }
  if (env.NODE_ENV === 'production' && key.length < 32) {
    throw new Error('AUDIT_KEY must contain at least 32 characters');
  }
  return key;
}

function canonical(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString());
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function toPlain(value) {
  return value === undefined || value === null ? null : JSON.parse(JSON.stringify(value));
}

export function computeAuditHash(key, entry) {
  const payload = canonical({
    seq: entry.seq,
    prevHash: entry.prevHash,
    at: entry.at instanceof Date ? entry.at : new Date(entry.at),
    actor: entry.actor ?? null,
    action: entry.action,
    target: entry.target ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    result: entry.result
  });
  return crypto.createHmac('sha256', key).update(payload).digest('hex');
}

export function actorFromUser(user) {
  if (!user) {
    return null;
  }
  return { id: String(user.id), role: user.role ?? null };
}

function normalizeActor(actor) {
  if (typeof actor === 'string') {
    return { id: actor, role: null };
  }
  return toPlain(actor);
}

function normalizeTarget(target) {
  if (typeof target === 'string') {
    return { type: null, id: target, cinemaSlug: isValidSlug(target) ? target : null };
  }
  return toPlain(target);
}

export function createAuditAppender({ audits = AuditLog, key, now = () => new Date() } = {}) {
  let resolvedKey = key;
  return async function appendAudit({ actor, action, target = null, before = null, after = null, result = 'SUCCESS' }) {
    resolvedKey ??= resolveAuditKey();
    const base = {
      at: now(),
      actor: normalizeActor(actor),
      action: String(action),
      target: normalizeTarget(target),
      before: toPlain(before),
      after: toPlain(after),
      result: String(result)
    };
    for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
      const last = await audits.findOne({}, { seq: 1, hash: 1 }).sort({ seq: -1 }).lean();
      const entry = {
        ...base,
        seq: (last?.seq ?? 0) + 1,
        prevHash: last?.hash ?? AUDIT_GENESIS_HASH
      };
      entry.hash = computeAuditHash(resolvedKey, entry);
      try {
        await audits.create(entry);
        return entry;
      } catch (err) {
        if (err?.code !== 11000) {
          throw err;
        }
      }
    }
    throw new Error('Impossible d\'ajouter l\'entrée d\'audit (contention)');
  };
}

export const appendAudit = createAuditAppender();

export function auditRequest(req, action, details = {}) {
  return appendAudit({ actor: actorFromUser(req.sessionUser), action, ...details });
}

export function auditForbiddenResponses(req, res, next) {
  const sendJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode !== 403 || !req.sessionUser || res.locals.deniedAudited) {
      return sendJson(body);
    }
    res.locals.deniedAudited = true;
    const route = `${req.method} ${req.originalUrl.split('?')[0]}`;
    const isMfa = /\/mfa\/verify$/.test(req.originalUrl.split('?')[0]);
    auditRequest(req, isMfa ? 'MFA_VERIFY' : 'ACCESS_DENIED', {
      target: { type: 'route', id: route, cinemaSlug: req.tenant?.slug ?? null },
      result: isMfa ? 'MFA_FAILED' : 'DENIED'
    }).then(
      () => sendJson(body),
      (err) => {
        console.error('[Audit] denial could not be recorded:', err.message);
        res.status(503).type('application/problem+json');
        sendJson(buildProblemDetail(503, 'Service Unavailable', 'Le service est momentanément indisponible.'));
      }
    );
    return res;
  };
  next();
}

function sameHash(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function verifyAuditChain(entries, key = resolveAuditKey()) {
  let expectedSeq = 1;
  let prevHash = AUDIT_GENESIS_HASH;
  let count = 0;
  for await (const entry of entries) {
    const failure = (reason) => ({ ok: false, count, brokenAt: entry.seq, reason });
    if (entry.seq !== expectedSeq) {
      return failure('SEQ_GAP');
    }
    if (entry.prevHash !== prevHash) {
      return failure('PREV_HASH_MISMATCH');
    }
    if (!sameHash(computeAuditHash(key, entry), entry.hash)) {
      return failure('HASH_MISMATCH');
    }
    prevHash = entry.hash;
    expectedSeq += 1;
    count += 1;
  }
  return { ok: true, count, lastHash: prevHash };
}
