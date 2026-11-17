import assert from 'node:assert/strict';
import http from 'node:http';
import test, { mock, beforeEach, afterEach } from 'node:test';
import express from 'express';
import { AuditLog } from '../src/models/AuditLog.js';
import { createAdminLogRouter, MAX_PAGE_SIZE } from '../src/routes/adminLogRoutes.js';
import { createMemoryModel } from './helpers/memoryModel.js';
import { auditForbiddenResponses } from '../src/events/audit.js';

let reservationLogs;
let auditLogs;
let users;

const day = (d) => new Date(`2026-11-${String(d).padStart(2, '0')}T10:00:00.000Z`);

beforeEach(async () => {
  reservationLogs = createMemoryModel();
  auditLogs = createMemoryModel({ unique: ['seq', 'prevHash'] });
  users = createMemoryModel();
  await users.create({ _id: 'u-1', email: 'ada@cineslot.test' });
  await users.create({ _id: 'root', email: 'root@cineslot.test' });
  mock.method(AuditLog, 'findOne', (...args) => auditLogs.findOne(...args));
  mock.method(AuditLog, 'create', (doc) => auditLogs.create(doc));
  const seed = [
    ['lumiere', 'BOOKED', 'movie-1', 'slot-1', 1],
    ['lumiere', 'CANCELLED', 'movie-1', 'slot-1', 2],
    ['lumiere', 'REJECTED_FULL', 'movie-2', 'slot-2', 3],
    ['rex', 'BOOKED', 'movie-1', 'slot-9', 4],
    ['rex', 'REJECTED_DISABLED', 'movie-3', 'slot-8', 5]
  ];
  for (const [cinemaSlug, action, movieId, slotId, d] of seed) {
    await reservationLogs.create({ at: day(d), action, cinemaSlug, movieId, slotId, bookingId: null, userId: 'u-1', quantity: 1, traceId: `trace-${d}` });
  }
  await auditLogs.create({ seq: 1, prevHash: '0', hash: 'h1', at: day(1), actor: { id: 'root' }, action: 'CINEMA_DISABLE', target: { type: 'cinema', id: 'rex', cinemaSlug: 'rex' }, result: 'SUCCESS' });
  await auditLogs.create({ seq: 2, prevHash: 'h1', hash: 'h2', at: day(2), actor: { id: 'adm' }, action: 'SLOT_UPDATE', target: { type: 'slot', id: 's1', cinemaSlug: 'lumiere' }, result: 'SUCCESS' });
});

afterEach(() => mock.restoreAll());

const USERS = {
  root: { id: 'root', role: 'SUPER_ADMIN', cinemaSlugs: [] },
  lumiereAdmin: { id: 'adm-l', role: 'CINEMA_ADMIN', cinemaSlugs: ['lumiere'] },
  spectator: { id: 'u-1', role: 'SPECTATOR', cinemaSlugs: [] }
};

async function withApp(fn) {
  const app = express();
  app.use((req, _res, next) => {
    req.sessionUser = USERS[req.headers['x-test-user']] ?? null;
    next();
  });
  app.use(auditForbiddenResponses);
  app.use('/api/admin', createAdminLogRouter({ reservationLogs, auditLogs, users }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  const get = async (path, user) => {
    const res = await fetch(`${base}${path}`, { headers: user ? { 'x-test-user': user } : {} });
    return { status: res.status, headers: res.headers, body: await res.json() };
  };
  try {
    await fn(get);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('SUPER_ADMIN sees every cinema, newest first, with filters', async () => {
  await withApp(async (get) => {
    const all = await get('/logs/reservations', 'root');
    assert.equal(all.status, 200);
    assert.equal(all.headers.get('cache-control'), 'no-store');
    assert.equal(all.body.total, 5);
    assert.deepEqual(all.body.items.map((i) => i.traceId), ['trace-5', 'trace-4', 'trace-3', 'trace-2', 'trace-1']);

    const filtered = await get('/logs/reservations?movie=movie-1&action=BOOKED', 'root');
    assert.deepEqual(filtered.body.items.map((i) => i.cinemaSlug).sort(), ['lumiere', 'rex']);

    const bySlot = await get('/logs/reservations?cinema=rex&slot=slot-8', 'root');
    assert.equal(bySlot.body.total, 1);
    assert.equal(bySlot.body.items[0].action, 'REJECTED_DISABLED');

    const range = await get(`/logs/reservations?from=${day(2).toISOString()}&to=${day(3).toISOString()}`, 'root');
    assert.equal(range.body.total, 2);
  });
});

test('CINEMA_ADMIN does not see logs of another cinema', async () => {
  await withApp(async (get) => {
    const own = await get('/logs/reservations', 'lumiereAdmin');
    assert.equal(own.status, 200);
    assert.equal(own.body.total, 3);
    assert.ok(own.body.items.every((i) => i.cinemaSlug === 'lumiere'));

    const byMovie = await get('/logs/reservations?movie=movie-1', 'lumiereAdmin');
    assert.ok(byMovie.body.items.every((i) => i.cinemaSlug === 'lumiere'));

    const other = await get('/logs/reservations?cinema=rex', 'lumiereAdmin');
    assert.equal(other.status, 403);
    assert.equal(other.body.status, 403);
    assert.equal(JSON.stringify(other.body).includes('trace-4'), false);

    const audit = await get('/audit', 'lumiereAdmin');
    assert.deepEqual(audit.body.items.map((e) => e.target.cinemaSlug), ['lumiere']);
    assert.equal((await get('/audit?cinema=rex', 'lumiereAdmin')).status, 403);

    const denied = auditLogs.docs.filter((d) => d.action === 'ACCESS_DENIED');
    assert.equal(denied.length, 2, 'each refusal is audited before answering');
    assert.deepEqual(denied[0].actor, { id: 'adm-l', role: 'CINEMA_ADMIN' });
    assert.equal(denied[0].target.cinemaSlug, 'rex');
    assert.equal(denied[0].result, 'DENIED');
  });
});

test('CINEMA_ADMIN without any cinema sees nothing', async () => {
  USERS.emptyAdmin = { id: 'adm-0', role: 'CINEMA_ADMIN' };
  await withApp(async (get) => {
    const res = await get('/logs/reservations', 'emptyAdmin');
    assert.equal(res.status, 200);
    assert.equal(res.body.total, 0);
  });
  delete USERS.emptyAdmin;
});

test('SPECTATOR gets 403 (audited), anonymous gets 401', async () => {
  await withApp(async (get) => {
    assert.equal((await get('/logs/reservations', 'spectator')).status, 403);
    assert.equal((await get('/audit', 'spectator')).status, 403);
    assert.equal((await get('/logs/reservations')).status, 401);
    assert.equal(auditLogs.docs.filter((d) => d.action === 'ACCESS_DENIED').length, 2);
  });
});

test('pagination is bounded and query parameters are validated', async () => {
  await withApp(async (get) => {
    const page2 = await get('/logs/reservations?limit=2&page=2', 'root');
    assert.deepEqual(
      { page: page2.body.page, limit: page2.body.limit, total: page2.body.total, totalPages: page2.body.totalPages },
      { page: 2, limit: 2, total: 5, totalPages: 3 }
    );
    assert.deepEqual(page2.body.items.map((i) => i.traceId), ['trace-3', 'trace-2']);

    for (const query of [
      `limit=${MAX_PAGE_SIZE + 1}`,
      'limit=0',
      'page=0',
      'page=1001',
      'page=abc',
      'page=1&page=2',
      'action=DROP',
      'cinema=admin',
      'cinema=Rex',
      'movie[$ne]=x',
      'from=yesterday',
      `from=${day(5).toISOString()}&to=${day(1).toISOString()}`
    ]) {
      const res = await get(`/logs/reservations?${query}`, 'root');
      assert.equal(res.status, 400, query);
      assert.match(res.headers.get('content-type'), /application\/problem\+json/);
    }
    assert.equal((await get('/audit?action=drop table', 'root')).status, 400);
  });
});

test('logs expose the email of the user / actor instead of only the id', async () => {
  await withApp(async (get) => {
    const resa = await get('/logs/reservations', 'root');
    assert.equal(resa.body.items[0].userEmail, 'ada@cineslot.test');

    const audit = await get('/audit', 'root');
    const byActor = Object.fromEntries(audit.body.items.map((i) => [i.actor.id, i.actor.email]));
    assert.equal(byActor.root, 'root@cineslot.test');
    assert.equal(byActor.adm, null);
  });
});
