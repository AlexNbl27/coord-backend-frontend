import { Cinema } from '../models/Cinema.js';

const DEFAULT_TTL_MS = 30_000;
const DEFAULT_MAX_ENTRIES = 500;

export function createCinemaStatusCache({
  CinemaModel = Cinema,
  ttlMs = DEFAULT_TTL_MS,
  maxEntries = DEFAULT_MAX_ENTRIES,
  nowFn = () => Date.now()
} = {}) {
  const cache = new Map();

  function getCached(slug) {
    const entry = cache.get(slug);
    if (!entry) {
      return undefined;
    }
    if (nowFn() > entry.expiresAt) {
      cache.delete(slug);
      return undefined;
    }
    cache.delete(slug);
    cache.set(slug, entry);
    return entry.status;
  }

  function setCached(slug, status) {
    if (cache.has(slug)) {
      cache.delete(slug);
    } else if (cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }
    cache.set(slug, { status, expiresAt: nowFn() + ttlMs });
  }

  function invalidate(slug, broadcast = true) {
    if (slug) {
      cache.delete(slug);
    } else {
      cache.clear();
    }
    if (broadcast && process.send) {
      process.send({ type: 'CLEAR_CINEMA_CACHE', slug: slug || null, originPid: process.pid });
    }
  }

  async function getStatus(slug) {
    if (!slug) {
      return null;
    }
    const cached = getCached(slug);
    if (cached !== undefined) {
      return cached;
    }
    let doc;
    try {
      const query = CinemaModel.findOne({ slug }, 'status');
      doc = typeof query?.lean === 'function' ? await query.lean() : await query;
    } catch {
      const err = new Error('Registre des cinémas indisponible.');
      err.status = 503;
      throw err;
    }
    const status = doc?.status ?? null;
    if (status !== null) {
      setCached(slug, status);
    }
    return status;
  }

  return { getStatus, invalidate, _cache: cache };
}

const defaultCache = createCinemaStatusCache();

export function invalidateCinemaStatusCache(slug, broadcast = true) {
  defaultCache.invalidate(slug, broadcast);
}

export function getCinemaStatus(slug) {
  return defaultCache.getStatus(slug);
}

if (process.on) {
  process.on('message', (msg) => {
    if (msg && msg.type === 'CLEAR_CINEMA_CACHE' && msg.originPid !== process.pid) {
      defaultCache.invalidate(msg.slug, false);
    }
  });
}
