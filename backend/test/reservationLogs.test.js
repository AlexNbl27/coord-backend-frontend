import assert from 'node:assert/strict';
import test, { mock, beforeEach, afterEach } from 'node:test';
import { trace } from '@opentelemetry/api';
import { ReservationLog } from '../src/models/ReservationLog.js';
import { reserveSlot, cancelSlot } from '../src/services/slotService.js';
import { createReservationEmitter, onReservationEvent } from '../src/events/reservationEvents.js';
import { createMemoryModel } from './helpers/memoryModel.js';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';
const USER = { id: 'u-1', name: 'Ada', email: 'ada@cineslot.test', role: 'SPECTATOR' };
const lean = (value) => ({ lean: async () => value });
const ACTIVE = { getCinemaStatus: async () => 'ACTIVE', getCinemaAddress: async () => '1 place Bellecour, Lyon' };

let logs;
let published;
let unsubscribe;
let Slot;
let Booking;
let TENANT;

beforeEach(() => {
  Slot = { findOneAndUpdate: async () => null, findById: () => lean(null), exists: async () => null };
  Booking = { findOne: () => lean(null), create: async (doc) => doc, updateOne: async () => ({}), countDocuments: async () => 0 };
  TENANT = {
    slug: 'lumiere',
    status: 'ACTIVE',
    db: { models: { Slot, Booking }, model: () => { throw new Error('modèle inattendu'); } }
  };
  logs = createMemoryModel();
  published = [];
  mock.method(ReservationLog, 'create', (doc) => logs.create(doc));
  mock.method(trace, 'getActiveSpan', () => trace.wrapSpanContext({ traceId: TRACE_ID, spanId: '00f067aa0ba902b7', traceFlags: 1 }));
  unsubscribe = onReservationEvent((event) => { published.push(event); });
});

afterEach(() => {
  unsubscribe();
  mock.restoreAll();
});

function lastLog() {
  assert.equal(logs.docs.length, 1, 'exactly one log entry');
  const { _id, at, ...rest } = logs.docs[0];
  assert.ok(at instanceof Date);
  return rest;
}

test('reserveSlot success logs BOOKED with traceId and publishes it', async () => {
  mock.method(Booking, 'findOne', () => lean(null));
  mock.method(Booking, 'create', async (doc) => doc);
  const winner = {
    _id: 'slot-1', movieId: 'movie-9', status: 'AVAILABLE', capacity: 40, availableSeats: 38, version: 1, startsAt: '2026-12-01T20:00:00Z'
  };
  mock.method(Slot, 'findById', () => lean(winner));
  mock.method(Slot, 'findOneAndUpdate', async () => winner);

  const booking = await reserveSlot('slot-1', null, null, false, USER, [{ category: 'ADULT', quantity: 2 }], TENANT, ACTIVE);

  assert.deepEqual(lastLog(), {
    action: 'BOOKED',
    cinemaSlug: 'lumiere',
    slotId: 'slot-1',
    movieId: 'movie-9',
    bookingId: booking.bookingId,
    userId: 'u-1',
    quantity: 2,
    traceId: TRACE_ID,
    reason: null
  });
  assert.equal(published.length, 1);
  assert.equal(published[0].action, 'BOOKED');
  assert.ok(Object.isFrozen(published[0]));
});

test('reserveSlot on a full slot logs REJECTED_FULL', async () => {
  mock.method(Booking, 'findOne', () => lean(null));
  mock.method(Slot, 'findOneAndUpdate', async () => null);
  mock.method(Slot, 'findById', () => lean({ _id: 'slot-1', movieId: 'movie-9', status: 'BOOKED', availableSeats: 0 }));

  await assert.rejects(reserveSlot('slot-1', null, null, false, USER, null, TENANT, ACTIVE), { status: 409 });
  const log = lastLog();
  assert.equal(log.action, 'REJECTED_FULL');
  assert.equal(log.movieId, 'movie-9');
  assert.equal(log.bookingId, null);
  assert.equal(log.quantity, 1);
});

test('reserveSlot with an existing booking logs REJECTED_CONFLICT', async () => {
  mock.method(Booking, 'findOne', () => lean({ _id: 'book-0', movieId: 'movie-9' }));
  const update = mock.method(Slot, 'findOneAndUpdate', async () => null);

  await assert.rejects(reserveSlot('slot-1', null, null, false, USER, null, TENANT, ACTIVE), { status: 409 });
  const log = lastLog();
  assert.equal(log.action, 'REJECTED_CONFLICT');
  assert.equal(log.bookingId, 'book-0');
  assert.equal(update.mock.callCount(), 0);
});

test('reserveSlot on a disabled cinema logs REJECTED_DISABLED and answers 423', async () => {
  mock.method(Booking, 'findOne', () => lean(null));
  const update = mock.method(Slot, 'findOneAndUpdate', async () => null);

  await assert.rejects(
    reserveSlot('slot-1', null, null, false, USER, [{ category: 'YOUTH', quantity: 3 }], TENANT, { ...ACTIVE, getCinemaStatus: async () => 'DISABLED' }),
    { status: 423 }
  );
  const log = lastLog();
  assert.equal(log.action, 'REJECTED_DISABLED');
  assert.equal(log.cinemaSlug, 'lumiere');
  assert.equal(log.quantity, 3);
  assert.equal(update.mock.callCount(), 0, 'no seat taken');
});

test('reserveSlot with invalid tickets logs nothing', async () => {
  await assert.rejects(reserveSlot('slot-1', null, null, false, USER, [{ category: 'VIP', quantity: 1 }], TENANT, ACTIVE), { status: 400 });
  assert.equal(logs.docs.length, 0);
});

test('cancelSlot logs CANCELLED with the restored quantity', async () => {
  Booking.findOneAndUpdate = () => lean({ _id: 'book-1', ownerId: 'u-1', movieId: 'movie-9', totalQuantity: 4 });
  mock.method(Booking, 'countDocuments', async () => 0);
  mock.method(Slot, 'findOneAndUpdate', async () => ({ _id: 'slot-1', status: 'AVAILABLE', capacity: 40, availableSeats: 40, version: 2 }));

  await cancelSlot('slot-1', USER, TENANT);
  assert.deepEqual(lastLog(), {
    action: 'CANCELLED',
    cinemaSlug: 'lumiere',
    slotId: 'slot-1',
    movieId: 'movie-9',
    bookingId: 'book-1',
    userId: 'u-1',
    quantity: 4,
    traceId: TRACE_ID,
    reason: null
  });
  assert.equal(published[0].action, 'CANCELLED');
});

test('emitter: unknown action is a programming error, insert failure does not break the flow', async () => {
  const emit = createReservationEmitter({ logs: { create: async () => { throw new Error('mongo down'); } } });
  await assert.rejects(emit({ action: 'DELETED_EVERYTHING' }), TypeError);
  const original = console.error;
  console.error = () => {};
  try {
    const entry = await emit({ action: 'BOOKED', slotId: 's', quantity: -5, traceId: 'explicit' });
    assert.equal(entry.quantity, 0);
    assert.equal(entry.traceId, 'explicit');
  } finally {
    console.error = original;
  }
  assert.equal(published.at(-1).action, 'BOOKED', 'still published for stats');
});

test('reservation_logs and audit_logs reject updates and deletes', async () => {
  const { AuditLog } = await import('../src/models/AuditLog.js');
  mock.restoreAll();
  for (const model of [ReservationLog, AuditLog]) {
    await assert.rejects(model.updateOne({}, { $set: { action: 'X' } }), /insertion seule/);
    await assert.rejects(model.deleteMany({}), /insertion seule/);
    await assert.rejects(model.findOneAndUpdate({}, { $set: { action: 'X' } }), /insertion seule/);
  }
});
