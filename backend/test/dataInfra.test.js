import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { cancelSlot, reserveSlot } from '../src/services/slotService.js';
import { bookingSchema } from '../src/models/Booking.js';
import { ReservationLog } from '../src/models/ReservationLog.js';

const query = (value) => ({ lean: async () => value });
const ACTIVE = { getCinemaStatus: async () => 'ACTIVE', getCinemaAddress: async () => '' };

function tenantWith(t) {
  const Slot = { findOneAndUpdate: async () => null, findById: () => query(null), exists: async () => null };
  const Booking = { findOne: () => query(null), findOneAndUpdate: () => query(null), create: async (doc) => doc, countDocuments: async () => 0 };
  t.mock.method(ReservationLog, 'create', async (doc) => doc);
  return { Slot, Booking, tenant: { slug: 'lumiere', status: 'ACTIVE', db: { models: { Slot, Booking }, model: () => { throw new Error('modèle inattendu'); } } } };
}

test('cancelSlot: two concurrent cancellations release seats only once', async (t) => {
  const booking = { _id: 'b-1', slotId: 's-1', ownerId: 'u-1', status: 'CONFIRMED', totalQuantity: 3 };
  const slot = { _id: 's-1', status: 'AVAILABLE', capacity: 10, availableSeats: 7, version: 0 };
  let releases = 0;
  const { Slot, Booking, tenant } = tenantWith(t);

  t.mock.method(Booking, 'findOneAndUpdate', (filter, update) => {
    const match = booking.slotId === filter.slotId && booking.ownerId === filter.ownerId && booking.status === filter.status;
    if (!match) return query(null);
    const before = { ...booking };
    Object.assign(booking, update.$set);
    return query(before);
  });
  t.mock.method(Booking, 'findOne', () => query(null));
  t.mock.method(Booking, 'countDocuments', async () => 0);
  t.mock.method(Slot, 'exists', async () => ({ _id: 's-1' }));
  t.mock.method(Slot, 'findOneAndUpdate', async () => {
    releases += 1;
    slot.availableSeats += 3;
    return slot;
  });

  const results = await Promise.allSettled([
    cancelSlot('s-1', { id: 'u-1' }, tenant),
    cancelSlot('s-1', { id: 'u-1' }, tenant)
  ]);

  assert.equal(releases, 1);
  assert.equal(slot.availableSeats, 10);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(results.find((r) => r.status === 'rejected').reason.status, 400);
});

test('reserveSlot: a duplicate booking caught by the unique index gives seats back and returns 409', async (t) => {
  const slot = { _id: 's-1', status: 'AVAILABLE', capacity: 10, availableSeats: 9, version: 1, startsAt: '2026-12-01T20:00:00.000Z' };
  const slotUpdates = [];
  const { Slot, Booking, tenant } = tenantWith(t);

  t.mock.method(Booking, 'findOne', () => query(null));
  t.mock.method(Booking, 'countDocuments', async () => 1);
  t.mock.method(Booking, 'create', async () => { throw Object.assign(new Error('dup'), { code: 11000 }); });
  t.mock.method(Slot, 'findOneAndUpdate', async (filter, update) => {
    slotUpdates.push(update);
    return slot;
  });

  await assert.rejects(
    () => reserveSlot('s-1', null, null, false, { id: 'u-1', name: 'Ada' }, [{ category: 'ADULT', quantity: 1 }], tenant, ACTIVE),
    (err) => err.status === 409
  );
  assert.equal(slotUpdates.length, 2);
  assert.ok(JSON.stringify(slotUpdates[1]).includes('"$add":[{"$ifNull":["$availableSeats",0]},1]'));
});

test('Booking: one CONFIRMED booking per owner and slot is enforced by a partial unique index', () => {
  const index = bookingSchema.indexes().find(([keys]) => keys.slotId === 1 && keys.ownerId === 1);
  assert.ok(index);
  assert.equal(index[1].unique, true);
  assert.deepEqual(index[1].partialFilterExpression, { status: 'CONFIRMED' });
});

function startWith(env) {
  const { SESSION_SECRET: _s, NODE_ENV: _n, ...rest } = process.env;
  return spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/services/sessionService.js')"], {
    cwd: new URL('..', import.meta.url),
    env: { ...rest, ...env },
    encoding: 'utf8'
  });
}

test('sessionService: startup fails without a secret or with a short one, outside NODE_ENV=test', () => {
  for (const env of [{}, { NODE_ENV: 'production' }, { NODE_ENV: 'development' }, { SESSION_SECRET: 'too-short', NODE_ENV: 'test' }]) {
    const run = startWith(env);
    assert.notEqual(run.status, 0, JSON.stringify(env));
    assert.match(run.stderr, /SESSION_SECRET/);
  }
  assert.equal(startWith({ NODE_ENV: 'test' }).status, 0);
  assert.equal(startWith({ SESSION_SECRET: 'x'.repeat(32), NODE_ENV: 'production' }).status, 0);
});
