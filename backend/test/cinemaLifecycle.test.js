import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createAdminCinemaRouter } from '../src/routes/adminCinemaRoutes.js';
import { createAdminSessionRouter } from '../src/routes/adminSessionRoutes.js';
import { createGoogleAuthRouter } from '../src/routes/googleAuthRoutes.js';
import { createCinemaStatusCache } from '../src/services/cinemaStatusService.js';
import { reserveSlot } from '../src/services/slotService.js';
import { runPurgeCinemasJob } from '../src/jobs/purgeCinemasJob.js';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_ABSOLUTE_TTL_MS,
  ADMIN_SLIDING_TTL_MS,
  SESSION_COOKIE_NAME,
  createAttachSession,
  hashPassword,
  rejectDuplicateSessionCookies,
  signAdminSessionToken,
  verifyAdminSessionToken
} from '../src/services/sessionService.js';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode
} from '../src/services/totpService.js';

function createInMemoryCinemas(initial = []) {
  const docs = initial.map((d) => ({ ...d }));
  const matches = (doc, filter) => Object.entries(filter).every(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if ('$lte' in v) return doc[k] != null && doc[k] <= v.$lte;
      if ('$ne' in v) return doc[k] !== v.$ne;
    }
    return doc[k] === v;
  });
  return {
    docs,
    find(filter = {}) {
      const res = docs.filter((d) => matches(d, filter)).map((d) => ({ ...d }));
      return {
        sort() { return this; },
        lean: async () => res,
        then: (resolve, reject) => Promise.resolve(res).then(resolve, reject)
      };
    },
    findOne(filter) {
      const doc = docs.find((d) => matches(d, filter)) ?? null;
      const res = doc ? { ...doc } : null;
      return {
        lean: async () => res,
        then: (resolve, reject) => Promise.resolve(res).then(resolve, reject)
      };
    },
    async create(doc) {
      if (docs.some((d) => d.slug === doc.slug)) {
        throw Object.assign(new Error('dup'), { code: 11000 });
      }
      const created = { ...doc };
      docs.push(created);
      return { ...created };
    },
    async findOneAndUpdate(filter, update, opts = {}) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      const before = { ...doc };
      Object.assign(doc, update.$set);
      return opts.new ? { ...doc } : before;
    }
  };
}

function createInMemoryLocks() {
  const locks = new Map();
  return {
    async findOneAndUpdate(filter, update) {
      const existing = locks.get(filter._id);
      if (!existing) return null;
      if (filter.expiresAt?.$lte && !(existing.expiresAt <= filter.expiresAt.$lte)) {
        return null;
      }
      const updated = { _id: filter._id, ...update.$set };
      locks.set(filter._id, updated);
      return updated;
    },
    async create(doc) {
      if (locks.has(doc._id)) {
        throw Object.assign(new Error('dup'), { code: 11000 });
      }
      locks.set(doc._id, { ...doc });
      return { ...doc };
    },
    async deleteOne(filter) {
      const existing = locks.get(filter._id);
      if (existing && (!filter.owner || existing.owner === filter.owner)) {
        locks.delete(filter._id);
      }
    }
  };
}

function createInMemoryUsers(initial = []) {
  const docs = initial.map((d) => ({ ...d }));
  const matches = (doc, filter) => Object.entries(filter).every(([k, v]) => {
    if (v === null) return doc[k] == null;
    return doc[k] === v;
  });
  return {
    docs,
    findOne(filter) {
      const doc = docs.find((d) => matches(d, filter)) ?? null;
      const res = doc ? { ...doc } : null;
      return {
        lean: async () => res,
        then: (resolve, reject) => Promise.resolve(res).then(resolve, reject)
      };
    },
    async create(doc) {
      if (docs.some((d) => d.email === doc.email)) throw Object.assign(new Error('dup'), { code: 11000 });
      docs.push({ ...doc });
      return { ...doc };
    },
    async findOneAndUpdate(filter, update) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      const before = { ...doc };
      Object.assign(doc, update.$set);
      for (const [k, n] of Object.entries(update.$inc ?? {})) doc[k] = (doc[k] ?? 0) + n;
      return before;
    }
  };
}

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('disabling a cinema returns 423 on subsequent reservation and 503 if registry is unavailable', async () => {
  const cinemas = createInMemoryCinemas([
    { slug: 'lyon-bellecour', name: 'Lyon Bellecour', status: 'ACTIVE' }
  ]);
  const cache = createCinemaStatusCache({ CinemaModel: cinemas, ttlMs: 30_000, maxEntries: 2 });

  const adminUser = {
    _id: 'sa-1',
    name: 'Super Admin',
    email: 'sa@cineslot.test',
    role: 'SUPER_ADMIN',
    cinemaSlugs: [],
    sessionVersion: 0
  };
  const users = createInMemoryUsers([adminUser]);
  const audits = [];

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => { req.plane = 'admin'; next(); });
  app.use(createAttachSession(users));
  app.use('/api/admin/cinemas', createAdminCinemaRouter({
    cinemas,
    appendAudit: async (entry) => audits.push(entry),
    invalidateCinemaStatusCache: (slug) => cache.invalidate(slug, false),
    broadcastCinemaStatus: () => {}
  }));

  const token = signAdminSessionToken(adminUser, { mfaVerifiedAt: Date.now() });
  const cookie = `${ADMIN_COOKIE_NAME}=${token}`;

  await withServer(app, async (base) => {
    const patchRes = await fetch(`${base}/api/admin/cinemas/lyon-bellecour/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ status: 'DISABLED' })
    });
    assert.equal(patchRes.status, 200);
    assert.equal((await patchRes.json()).status, 'DISABLED');
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'CINEMA_STATUS_UPDATE');

    await assert.rejects(
      () => reserveSlot(
        'slot-1',
        'Client',
        null,
        false,
        { id: 'u1', name: 'Ada' },
        null,
        { slug: 'lyon-bellecour' },
        {
          Booking: { findOne: () => ({ lean: async () => null }) },
          getCinemaStatus: (slug) => cache.getStatus(slug)
        }
      ),
      (err) => err.status === 423
    );
  });

  const failingCache = createCinemaStatusCache({
    CinemaModel: { findOne: () => ({ lean: async () => { throw new Error('mongo down'); } }) }
  });
  await assert.rejects(
    () => failingCache.getStatus('lyon-bellecour'),
    (err) => err.status === 503
  );
});

test('soft delete cancels future reservations and emits CANCELLED events', async () => {
  const cinemas = createInMemoryCinemas([
    { slug: 'paris-opera', name: 'Paris Opéra', status: 'ACTIVE' }
  ]);
  const futureDate = new Date(Date.now() + 86_400_000).toISOString();
  const pastDate = new Date(Date.now() - 86_400_000).toISOString();
  const bookings = [
    { _id: 'b-future', slotId: 's-1', ownerId: 'u-1', status: 'CONFIRMED', startsAt: futureDate, totalQuantity: 2, movieId: 'm-1' },
    { _id: 'b-past', slotId: 's-2', ownerId: 'u-2', status: 'CONFIRMED', startsAt: pastDate, totalQuantity: 1, movieId: 'm-2' }
  ];
  const slotUpdates = [];
  const events = [];
  const audits = [];

  const BookingModel = {
    find(filter) {
      const res = bookings.filter((b) => b.status === filter.status && b.startsAt > filter.startsAt.$gt);
      return { lean: async () => res };
    },
    async findOneAndUpdate(filter, update) {
      const b = bookings.find((x) => x._id === filter._id && x.status === filter.status);
      if (!b) return null;
      Object.assign(b, update.$set);
      return b;
    }
  };
  const SlotModel = {
    async findOneAndUpdate(filter, update) {
      slotUpdates.push({ filter, update });
      return {};
    }
  };

  const adminUser = { _id: 'sa-1', name: 'SA', email: 'sa@cineslot.test', role: 'SUPER_ADMIN', cinemaSlugs: [] };
  const users = createInMemoryUsers([adminUser]);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => { req.plane = 'admin'; next(); });
  app.use(createAttachSession(users));
  app.use('/api/admin/cinemas', createAdminCinemaRouter({
    cinemas,
    useTenantDb: () => ({}),
    getTenantModels: () => ({ Slot: SlotModel, Booking: BookingModel }),
    emitReservationEvent: async (ev) => events.push(ev),
    appendAudit: async (entry) => audits.push(entry),
    invalidateCinemaStatusCache: () => {},
    broadcastCinemaStatus: () => {}
  }));

  const cookie = `${ADMIN_COOKIE_NAME}=${signAdminSessionToken(adminUser, { mfaVerifiedAt: Date.now() })}`;

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/admin/cinemas/paris-opera`, {
      method: 'DELETE',
      headers: { Cookie: cookie }
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'DELETED');
    assert.equal(body.cancelledBookings, 1);

    assert.equal(bookings[0].status, 'CANCELLED');
    assert.equal(bookings[1].status, 'CONFIRMED');
    assert.equal(events.length, 1);
    assert.equal(events[0].action, 'CANCELLED');
    assert.equal(events[0].cinemaSlug, 'paris-opera');
    assert.equal(events[0].bookingId, 'b-future');
    assert.equal(slotUpdates.length, 1);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, 'CINEMA_SOFT_DELETE');
  });
});

test('purge job: dry-run, idempotent double run, reactivated cinema not purged, and lease lock', async () => {
  const now = new Date('2026-11-17T10:00:00Z');
  const oldDeletedAt = new Date(now.getTime() - 65 * 24 * 60 * 60 * 1000);
  const recentDeletedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);

  const cinemas = createInMemoryCinemas([
    { slug: 'old-deleted', status: 'DELETED', deletedAt: oldDeletedAt, purgeState: 'PENDING' },
    { slug: 'recent-deleted', status: 'DELETED', deletedAt: recentDeletedAt, purgeState: 'PENDING' },
    { slug: 'reactivated', status: 'ACTIVE', deletedAt: null, purgeState: null }
  ]);
  const locks = createInMemoryLocks();
  const dropped = [];
  const audits = [];
  const getDb = (slug) => ({
    dropCollection: async (name) => { dropped.push(`${slug}.${name}`); }
  });

  const dryRes = await runPurgeCinemasJob({
    dryRun: true,
    nowFn: () => now,
    cinemas,
    locks,
    getDb,
    audit: async (e) => audits.push(e)
  });
  assert.deepEqual(dryRes.candidates, ['old-deleted']);
  assert.deepEqual(dryRes.purged, []);
  assert.equal(dropped.length, 0);
  assert.equal(cinemas.docs[0].purgeState, 'PENDING');

  const firstRun = await runPurgeCinemasJob({
    dryRun: false,
    nowFn: () => now,
    cinemas,
    locks,
    getDb,
    audit: async (e) => audits.push(e)
  });
  assert.deepEqual(firstRun.purged, ['old-deleted']);
  assert.deepEqual(dropped, ['old-deleted.slots', 'old-deleted.bookings']);
  assert.equal(cinemas.docs[0].purgeState, 'DONE');
  assert.equal(audits.length, 1);

  const secondRun = await runPurgeCinemasJob({
    dryRun: false,
    nowFn: () => now,
    cinemas,
    locks,
    getDb,
    audit: async (e) => audits.push(e)
  });
  assert.deepEqual(secondRun.purged, []);
  assert.equal(dropped.length, 2);

  const raceCinemas = {
    find: () => ({
      lean: async () => [{ slug: 'flipped-active', status: 'DELETED', deletedAt: oldDeletedAt, purgeState: 'PENDING' }]
    }),
    findOneAndUpdate: async () => null
  };
  const raceRun = await runPurgeCinemasJob({
    dryRun: false,
    nowFn: () => now,
    cinemas: raceCinemas,
    locks,
    getDb,
    audit: async (e) => audits.push(e)
  });
  assert.deepEqual(raceRun.purged, []);
  assert.equal(dropped.length, 2);
});

test('admin action without recent MFA returns 403', async () => {
  const cinemas = createInMemoryCinemas([]);
  const adminUser = { _id: 'sa-1', name: 'SA', email: 'sa@cineslot.test', role: 'SUPER_ADMIN', cinemaSlugs: [] };
  const users = createInMemoryUsers([adminUser]);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => { req.plane = 'admin'; next(); });
  app.use(createAttachSession(users));
  app.use('/api/admin/cinemas', createAdminCinemaRouter({ cinemas }));

  const noMfaCookie = `${ADMIN_COOKIE_NAME}=${signAdminSessionToken(adminUser, { mfaVerifiedAt: null })}`;
  const expiredMfaCookie = `${ADMIN_COOKIE_NAME}=${signAdminSessionToken(adminUser, { mfaVerifiedAt: Date.now() - 6 * 60 * 1000 })}`;
  const freshMfaCookie = `${ADMIN_COOKIE_NAME}=${signAdminSessionToken(adminUser, { mfaVerifiedAt: Date.now() })}`;

  await withServer(app, async (base) => {
    const res1 = await fetch(`${base}/api/admin/cinemas`, { headers: { Cookie: noMfaCookie } });
    assert.equal(res1.status, 403);
    assert.equal(res1.headers.get('content-type')?.includes('application/problem+json'), true);

    const res2 = await fetch(`${base}/api/admin/cinemas`, { headers: { Cookie: expiredMfaCookie } });
    assert.equal(res2.status, 403);

    const res3 = await fetch(`${base}/api/admin/cinemas`, { headers: { Cookie: freshMfaCookie } });
    assert.equal(res3.status, 200);
  });
});

test('admin session TTL (30m sliding, 8h absolute), TOTP encryption/verify, and duplicate cookie rejection', async () => {
  const user = { _id: 'sa-1', name: 'SA', email: 'sa@cineslot.test', role: 'SUPER_ADMIN', sessionVersion: 0 };
  const t0 = 1_700_000_000_000;
  const tok = signAdminSessionToken(user, { iat: t0, now: t0, mfaVerifiedAt: t0 });
  assert.ok(verifyAdminSessionToken(tok, t0 + ADMIN_SLIDING_TTL_MS - 1000));
  assert.equal(verifyAdminSessionToken(tok, t0 + ADMIN_SLIDING_TTL_MS + 1000), null);

  const nearAbs = signAdminSessionToken(user, { iat: t0, now: t0 + ADMIN_ABSOLUTE_TTL_MS - 1000 });
  assert.ok(verifyAdminSessionToken(nearAbs, t0 + ADMIN_ABSOLUTE_TTL_MS - 500));
  assert.equal(verifyAdminSessionToken(nearAbs, t0 + ADMIN_ABSOLUTE_TTL_MS + 1000), null);

  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret);
  assert.notEqual(encrypted, secret);
  assert.equal(decryptTotpSecret(encrypted), secret);
  const code = generateTotpCode(secret, t0);
  assert.equal(verifyTotpCode(secret, code, t0), true);
  assert.equal(verifyTotpCode(secret, '000000', t0), false);

  const app = express();
  app.use(rejectDuplicateSessionCookies);
  app.get('/ping', (_req, res) => res.json({ ok: true }));

  await withServer(app, async (base) => {
    const okRes = await fetch(`${base}/ping`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=abc` }
    });
    assert.equal(okRes.status, 200);

    const dupRes = await fetch(`${base}/ping`, {
      headers: { Cookie: `${SESSION_COOKIE_NAME}=abc; ${SESSION_COOKIE_NAME}=def` }
    });
    assert.equal(dupRes.status, 400);
    assert.equal(dupRes.headers.get('content-type')?.includes('application/problem+json'), true);
  });

  const adminUsers = createInMemoryUsers([{
    ...user,
    passwordHash: await hashPassword('super-secret-12')
  }]);
  const adminApp = express();
  adminApp.use(express.json());
  adminApp.use(cookieParser());
  adminApp.use((req, _res, next) => { req.plane = 'admin'; next(); });
  adminApp.use(createAttachSession(adminUsers));
  adminApp.use('/api/admin/session', createAdminSessionRouter({
    users: adminUsers,
    authLimiter: (_req, _res, next) => next(),
    loginLimiter: (_req, _res, next) => next()
  }));

  await withServer(adminApp, async (base) => {
    const loginRes = await fetch(`${base}/api/admin/session/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'sa@cineslot.test', password: 'super-secret-12' })
    });
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('set-cookie');
    assert.equal(setCookie.startsWith(`${ADMIN_COOKIE_NAME}=`), true);
    assert.equal(setCookie.toLowerCase().includes('domain='), false);
    const cookiePair = setCookie.split(';')[0];

    const setupRes = await fetch(`${base}/api/admin/session/mfa/setup`, {
      method: 'POST',
      headers: { Cookie: cookiePair }
    });
    assert.equal(setupRes.status, 200);
    const { secret: setupSecret } = await setupRes.json();

    const verifyRes = await fetch(`${base}/api/admin/session/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookiePair },
      body: JSON.stringify({ code: generateTotpCode(setupSecret) })
    });
    assert.equal(verifyRes.status, 200);
    const verifyBody = await verifyRes.json();
    assert.equal(typeof verifyBody.mfaVerifiedAt, 'number');
  });
});

test('google oauth stores HMAC-signed slug state and only redirects to ACTIVE cinema', async () => {
  const cinemas = createInMemoryCinemas([
    { slug: 'lyon', status: 'ACTIVE' },
    { slug: 'closed', status: 'DISABLED' }
  ]);
  const users = createInMemoryUsers([]);
  const app = express();
  app.use(cookieParser());
  app.use('/api/session/google', createGoogleAuthRouter({
    env: {
      GOOGLE_CLIENT_ID: 'cid',
      GOOGLE_CLIENT_SECRET: 'csec',
      APP_URL: 'http://cineslot.localhost:3001',
      SESSION_SECRET: 'test-secret'
    },
    users,
    cinemas,
    limiter: (_req, _res, next) => next(),
    fetch: async (url) => {
      if (String(url).includes('oauth2.googleapis.com/token')) {
        return { ok: true, json: async () => ({ access_token: 'tok' }) };
      }
      return { ok: true, json: async () => ({ sub: 'g-1', email: 'ada@cineslot.test', email_verified: true, name: 'Ada' }) };
    }
  }));

  await withServer(app, async (base) => {
    const startActive = await fetch(`${base}/api/session/google?slug=lyon&redirect=/slots`, { redirect: 'manual' });
    assert.equal(startActive.status, 302);
    const activeCookie = startActive.headers.get('set-cookie').split(';')[0];
    const activeState = new URL(startActive.headers.get('location')).searchParams.get('state');

    const cbActive = await fetch(`${base}/api/session/google/callback?code=c&state=${activeState}`, {
      headers: { Cookie: activeCookie },
      redirect: 'manual'
    });
    assert.equal(cbActive.status, 302);
    assert.equal(cbActive.headers.get('location'), 'http://lyon.cineslot.localhost:3001/slots');

    const startClosed = await fetch(`${base}/api/session/google?slug=closed&redirect=/slots`, { redirect: 'manual' });
    const closedCookie = startClosed.headers.get('set-cookie').split(';')[0];
    const closedState = new URL(startClosed.headers.get('location')).searchParams.get('state');

    const cbClosed = await fetch(`${base}/api/session/google/callback?code=c&state=${closedState}`, {
      headers: { Cookie: closedCookie },
      redirect: 'manual'
    });
    assert.equal(cbClosed.status, 302);
    assert.equal(cbClosed.headers.get('location'), 'http://cineslot.localhost:3001/login?error=cinema_unavailable');
  });
});
