import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createAdminStatsRouter } from '../src/routes/adminStatsRoutes.js';
import { applyReservationEvent, buildStatsQuery, parisDay, recomputeBookingStats } from '../src/stats/bookingStats.js';

function createStatsStore() {
  const docs = [];
  const sameKey = (d, f) => d.cinemaSlug === f.cinemaSlug && d.movieId === f.movieId && d.day === f.day;
  return {
    docs,
    async updateOne(filter, update, { upsert }) {
      const existing = docs.find((d) => sameKey(d, filter));
      if (existing && !existing.applied.includes(filter.applied.$ne)) {
        for (const [k, n] of Object.entries(update.$inc)) existing[k] += n;
        existing.applied.push(update.$push.applied);
        return;
      }
      if (existing || !upsert) throw Object.assign(new Error('E11000'), { code: 11000 });
      docs.push({ cinemaSlug: filter.cinemaSlug, movieId: filter.movieId, day: filter.day, ...update.$inc, applied: [update.$push.applied] });
    },
    async bulkWrite(ops) {
      for (const { replaceOne: { filter, replacement } } of ops) {
        const i = docs.findIndex((d) => sameKey(d, filter));
        if (i >= 0) docs[i] = { ...replacement };
        else docs.push({ ...replacement });
      }
    },
    async deleteMany(filter) {
      for (let i = docs.length - 1; i >= 0; i -= 1) {
        if (docs[i].recomputedAt !== filter.recomputedAt.$ne) docs.splice(i, 1);
      }
    }
  };
}

const counters = (docs) => docs
  .map(({ cinemaSlug, movieId, day, booked, cancelled, seats }) => ({ cinemaSlug, movieId, day, booked, cancelled, seats }))
  .sort((a, b) => `${a.cinemaSlug}${a.movieId}${a.day}`.localeCompare(`${b.cinemaSlug}${b.movieId}${b.day}`));

const LOGS = [
  { action: 'BOOKED', cinemaSlug: 'lumiere', movieId: 'm1', bookingId: 'b1', quantity: 3, at: new Date('2026-11-17T10:00:00Z') },
  { action: 'BOOKED', cinemaSlug: 'lumiere', movieId: 'm1', bookingId: 'b2', quantity: 2, at: new Date('2026-11-17T11:00:00Z') },
  { action: 'CANCELLED', cinemaSlug: 'lumiere', movieId: 'm1', bookingId: 'b1', quantity: 3, at: new Date('2026-11-17T12:00:00Z') },
  { action: 'REJECTED_FULL', cinemaSlug: 'lumiere', movieId: 'm1', bookingId: 'b3', quantity: 4, at: new Date('2026-11-17T12:30:00Z') },
  { action: 'BOOKED', cinemaSlug: 'rex', movieId: 'm2', bookingId: 'b4', quantity: 1, at: new Date('2026-11-17T23:30:00Z') }
];

test('parisDay: buckets by Europe/Paris calendar day', () => {
  assert.equal(parisDay('2026-11-17T23:30:00Z'), '2026-11-18');
  assert.equal(parisDay('2026-07-17T21:59:00Z'), '2026-07-17');
});

test('booking stats: counters are correct after bookings and cancellations, and replays are idempotent', async () => {
  const store = createStatsStore();
  for (const entry of [...LOGS, LOGS[0], LOGS[2]]) await applyReservationEvent(entry, store);

  assert.deepEqual(counters(store.docs), [
    { cinemaSlug: 'lumiere', movieId: 'm1', day: '2026-11-17', booked: 2, cancelled: 1, seats: 2 },
    { cinemaSlug: 'rex', movieId: 'm2', day: '2026-11-18', booked: 1, cancelled: 0, seats: 1 }
  ]);
});

test('booking stats: full recompute from reservation_logs gives the same counters', async () => {
  const live = createStatsStore();
  for (const entry of LOGS) await applyReservationEvent(entry, live);

  const rebuilt = createStatsStore();
  rebuilt.docs.push({ cinemaSlug: 'ghost', movieId: 'm9', day: '2026-01-01', booked: 9, cancelled: 0, seats: 9, applied: [] });
  rebuilt.docs.push({ cinemaSlug: 'lumiere', movieId: 'm1', day: '2026-11-17', booked: 99, cancelled: 0, seats: 99, applied: [] });
  assert.equal(await recomputeBookingStats(LOGS, rebuilt), 2);

  assert.deepEqual(counters(rebuilt.docs), counters(live.docs));
});

test('buildStatsQuery: validates parameters', () => {
  const admin = { role: 'SUPER_ADMIN' };
  assert.equal(buildStatsQuery({ groupBy: 'constructor' }, admin).status, 400);
  assert.equal(buildStatsQuery({ groupBy: 'day' }, admin).status, 400);
  assert.equal(buildStatsQuery({ from: '17/11/2026' }, admin).status, 400);
  assert.equal(buildStatsQuery({ cinema: { $ne: 'x' } }, admin).status, 400);
  assert.deepEqual(buildStatsQuery({ groupBy: 'cinema', from: '2026-11-01', to: '2026-11-30' }, admin), {
    groupBy: 'cinema',
    match: { day: { $gte: '2026-11-01', $lte: '2026-11-30' } }
  });
});

async function withStatsApp(sessionUser, fn) {
  const seen = [];
  const app = express();
  app.use((req, _res, next) => { req.sessionUser = sessionUser; next(); });
  app.use('/api/admin/stats', createAdminStatsRouter({ query: async (params) => { seen.push(params); return { rows: [], days: [] }; } }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await fn(`http://127.0.0.1:${server.address().port}/api/admin/stats/bookings`, seen);
  } finally {
    server.close();
  }
}

test('GET /api/admin/stats/bookings: CINEMA_ADMIN is limited to its cinemas', async () => {
  const cinemaAdmin = { id: 'u-2', role: 'CINEMA_ADMIN', cinemaSlugs: ['lumiere', 'rex'] };
  await withStatsApp(cinemaAdmin, async (url, seen) => {
    const own = await fetch(`${url}?groupBy=movie`);
    assert.equal(own.status, 200);
    assert.deepEqual(seen[0].match, { cinemaSlug: { $in: ['lumiere', 'rex'] } });

    const one = await fetch(`${url}?cinema=rex`);
    assert.equal(one.status, 200);
    assert.deepEqual(seen[1].match, { cinemaSlug: 'rex' });

    const other = await fetch(`${url}?cinema=pathe`);
    assert.equal(other.status, 403);
    assert.match(other.headers.get('content-type'), /application\/problem\+json/);
    assert.equal(seen.length, 2);
  });

  await withStatsApp({ id: 'u-3', role: 'CINEMA_ADMIN', cinemaSlugs: [] }, async (url, seen) => {
    assert.equal((await fetch(url)).status, 200);
    assert.deepEqual(seen[0].match, { cinemaSlug: { $in: [] } });
  });
});

test('GET /api/admin/stats/bookings: spectators are refused, SUPER_ADMIN sees every cinema', async () => {
  await withStatsApp({ id: 'u-1', role: 'SPECTATOR', cinemaSlugs: [] }, async (url, seen) => {
    assert.equal((await fetch(url)).status, 403);
    assert.equal(seen.length, 0);
  });
  await withStatsApp(null, async (url) => {
    assert.equal((await fetch(url)).status, 401);
  });
  await withStatsApp({ id: 'u-0', role: 'SUPER_ADMIN', cinemaSlugs: [] }, async (url, seen) => {
    assert.equal((await fetch(`${url}?groupBy=cinema&cinema=pathe`)).status, 200);
    assert.deepEqual(seen[0], { groupBy: 'cinema', match: { cinemaSlug: 'pathe' } });
  });
});
