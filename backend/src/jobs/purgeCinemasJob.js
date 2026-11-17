import crypto from 'node:crypto';
import { Cinema } from '../models/Cinema.js';
import { JobLock } from '../models/JobLock.js';
import { appendAudit } from '../events/index.js';
import { useTenantDb } from '../tenancy/index.js';

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const DEFAULT_LEASE_MS = 5 * 60 * 1000;
const LOCK_ID = 'purge-cinemas-j60';

async function acquireLease(locks, owner, now, leaseMs) {
  const expiresAt = new Date(now.getTime() + leaseMs);
  const existing = await locks.findOneAndUpdate(
    { _id: LOCK_ID, expiresAt: { $lte: now } },
    { $set: { owner, expiresAt } },
    { new: true }
  );
  if (existing) {
    return true;
  }
  try {
    await locks.create({ _id: LOCK_ID, owner, expiresAt });
    return true;
  } catch (err) {
    if (err?.code === 11000) {
      return false;
    }
    throw err;
  }
}

async function releaseLease(locks, owner) {
  if (typeof locks.deleteOne === 'function') {
    await locks.deleteOne({ _id: LOCK_ID, owner });
  } else if (typeof locks.findOneAndUpdate === 'function') {
    await locks.findOneAndUpdate({ _id: LOCK_ID, owner }, { $set: { expiresAt: new Date(0) } });
  }
}

async function dropCollectionSafe(db, name) {
  if (!db || typeof db.dropCollection !== 'function') {
    return;
  }
  try {
    await db.dropCollection(name);
  } catch (err) {
    if (err?.codeName !== 'NamespaceNotFound' && err?.code !== 26) {
      throw err;
    }
  }
}

export async function runPurgeCinemasJob({
  dryRun = false,
  nowFn = () => new Date(),
  leaseMs = DEFAULT_LEASE_MS,
  cinemas = Cinema,
  locks = JobLock,
  getDb = useTenantDb,
  audit = appendAudit,
  instanceId = `${process.pid}-${crypto.randomUUID()}`
} = {}) {
  const now = nowFn();
  const acquired = await acquireLease(locks, instanceId, now, leaseMs);
  if (!acquired) {
    return { skipped: true, reason: 'lock_held', dryRun, candidates: [], purged: [] };
  }

  try {
    const cutoff = new Date(now.getTime() - SIXTY_DAYS_MS);
    const query = cinemas.find({
      status: 'DELETED',
      deletedAt: { $lte: cutoff },
      purgeState: { $ne: 'DONE' }
    });
    const candidates = typeof query?.lean === 'function' ? await query.lean() : await query;

    if (dryRun) {
      return {
        skipped: false,
        dryRun: true,
        candidates: candidates.map((c) => c.slug),
        purged: []
      };
    }

    const purged = [];
    for (const candidate of candidates) {
      const claimed = await cinemas.findOneAndUpdate(
        {
          slug: candidate.slug,
          status: 'DELETED',
          deletedAt: { $lte: cutoff },
          purgeState: { $ne: 'DONE' }
        },
        { $set: { purgeState: 'DONE' } },
        { new: false }
      );
      if (!claimed) {
        continue;
      }

      const db = getDb(claimed.slug);
      await dropCollectionSafe(db, 'slots');
      await dropCollectionSafe(db, 'bookings');

      await audit({
        actor: 'system:purge-job',
        action: 'CINEMA_PURGE',
        target: claimed.slug,
        before: { status: claimed.status, purgeState: claimed.purgeState ?? null },
        after: { purgeState: 'DONE' },
        result: 'SUCCESS'
      });

      purged.push(claimed.slug);
    }

    return {
      skipped: false,
      dryRun: false,
      candidates: candidates.map((c) => c.slug),
      purged
    };
  } finally {
    await releaseLease(locks, instanceId);
  }
}
