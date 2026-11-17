import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelSlot, reserveSlot, getSeatMap } from '../src/services/slotService.js';
import { ReservationLog } from '../src/models/ReservationLog.js';
import {
  buildSeatLayout,
  isValidSeatSelection,
  normalizeSeatInput,
  pickBestSeats
} from '../src/utils/seatMap.js';
import { formatSeatLabel } from '../src/utils/ticketFormatters.js';

const query = (value) => ({ lean: async () => value });
const USER = { id: 'u-1', name: 'Ada' };
const OTHER = { id: 'u-2', name: 'Grace' };

function memorySlot(t, initial) {
  const slot = { _id: 's-1', status: 'AVAILABLE', capacity: 40, availableSeats: 40, takenSeats: [], version: 0, startsAt: '2026-12-01T20:00:00.000Z', ...initial };
  const created = [];
  const events = [];
  const Slot = {
    findById: () => query(structuredClone(slot)),
    findOneAndUpdate: async (filter) => {
      const conflict = filter.takenSeats?.$nin?.some((s) => slot.takenSeats.includes(s));
      if (conflict || slot.status !== 'AVAILABLE') return null;
      const seats = filter.takenSeats.$nin;
      if (slot.availableSeats < seats.length) return null;
      slot.takenSeats = [...slot.takenSeats, ...seats];
      slot.availableSeats -= seats.length;
      slot.status = slot.availableSeats <= 0 ? 'BOOKED' : 'AVAILABLE';
      slot.version += 1;
      return structuredClone(slot);
    },
    exists: async () => ({ _id: slot._id })
  };
  const Booking = {
    findOne: () => query(null),
    create: async (doc) => { created.push(doc); return doc; },
    countDocuments: async () => 0
  };
  const deps = {
    getCinemaStatus: async () => 'ACTIVE',
    getCinemaAddress: async () => '',
    emitReservationEvent: async (event) => { events.push(event); }
  };
  const tenant = { slug: 'lumiere', status: 'ACTIVE', db: { models: { Slot, Booking }, model: () => { throw new Error('modèle inattendu'); } } };
  t.mock.method(ReservationLog, 'create', async (doc) => doc);
  return { slot, Slot, Booking, created, events, deps, tenant };
}

test('buildSeatLayout: rangées de 10 sans I ni O, dernière rangée partielle', () => {
  assert.deepEqual(buildSeatLayout(40), {
    capacity: 40,
    cols: 10,
    rows: [
      { label: 'A', count: 10 },
      { label: 'B', count: 10 },
      { label: 'C', count: 10 },
      { label: 'D', count: 10 }
    ]
  });
  const layout = buildSeatLayout(96);
  assert.equal(layout.cols, 12);
  assert.equal(layout.rows.length, 8);
  assert.ok(!layout.rows.some((r) => r.label === 'I' || r.label === 'O'));
  assert.equal(buildSeatLayout(36).rows.at(-1).count, 6);
});

test('normalizeSeatInput: format strict, 10 places maximum', () => {
  assert.equal(normalizeSeatInput(undefined), null);
  assert.deepEqual(normalizeSeatInput([' c5', 'C6']), ['C5', 'C6']);
  assert.equal(normalizeSeatInput('C5'), false);
  assert.equal(normalizeSeatInput([]), false);
  assert.equal(normalizeSeatInput(['I3']), false);
  assert.equal(normalizeSeatInput(['C0']), false);
  assert.equal(normalizeSeatInput([{ $ne: 1 }]), false);
  assert.equal(normalizeSeatInput(Array.from({ length: 11 }, (_, i) => `A${i + 1}`)), false);
});

test('isValidSeatSelection: hors plan, doublon ou mauvais nombre refusés', () => {
  assert.equal(isValidSeatSelection(['C5', 'C6'], 40, 2), true);
  assert.equal(isValidSeatSelection(['E1'], 40, 1), false);
  assert.equal(isValidSeatSelection(['D7'], 36, 1), false);
  assert.equal(isValidSeatSelection(['C5', 'C5'], 40, 2), false);
  assert.equal(isValidSeatSelection(['C5'], 40, 2), false);
});

test('pickBestSeats: bloc contigu centré, sinon places isolées', () => {
  const layout = buildSeatLayout(40);
  assert.deepEqual(pickBestSeats(layout, [], 2), ['C5', 'C6']);
  assert.deepEqual(pickBestSeats(layout, ['C5'], 2), ['C6', 'C7']);
  const full = layout.rows.flatMap((r) => Array.from({ length: r.count }, (_, i) => `${r.label}${i + 1}`));
  const almostFull = full.filter((id) => !['A1', 'D10'].includes(id));
  assert.deepEqual(pickBestSeats(layout, almostFull, 2).sort(), ['A1', 'D10']);
  assert.equal(pickBestSeats(layout, almostFull, 3), null);
});

test('formatSeatLabel: même format que les billets existants', () => {
  assert.equal(formatSeatLabel(['D7']), 'Rangée D · Fauteuil 7');
  assert.equal(formatSeatLabel(['D8', 'D7']), 'Rangée D · Fauteuils 7, 8');
  assert.equal(formatSeatLabel(['E2', 'D7']), 'Rangée D · Fauteuil 7 / Rangée E · Fauteuil 2');
});

test('reserveSlot: les places choisies sont réservées et inscrites sur le billet', async (t) => {
  const { slot, created, deps, tenant } = memorySlot(t);
  const booking = await reserveSlot('s-1', null, null, false, USER, [{ category: 'ADULT', quantity: 2 }], tenant, { ...deps, seats: ['B3', 'B4'] });

  assert.deepEqual(booking.seats, ['B3', 'B4']);
  assert.equal(booking.seat, 'Rangée B · Fauteuils 3, 4');
  assert.deepEqual(created[0].seats, ['B3', 'B4']);
  assert.deepEqual(slot.takenSeats, ['B3', 'B4']);
  assert.equal(slot.availableSeats, 38);
});

test('reserveSlot: sélection hors plan ou au mauvais nombre → 400 sans rien réserver', async (t) => {
  const { slot, deps, tenant } = memorySlot(t);
  await assert.rejects(
    reserveSlot('s-1', null, null, false, USER, [{ category: 'ADULT', quantity: 2 }], tenant, { ...deps, seats: ['B3'] }),
    { status: 400 }
  );
  await assert.rejects(
    reserveSlot('s-1', null, null, false, USER, null, tenant, { ...deps, seats: ['Z1'] }),
    { status: 400 }
  );
  assert.deepEqual(slot.takenSeats, []);
});

test('reserveSlot: deux spectateurs sur la même place en même temps → un seul gagne', async (t) => {
  const { slot, events, deps, tenant } = memorySlot(t);
  const results = await Promise.allSettled([
    reserveSlot('s-1', null, null, false, USER, null, tenant, { ...deps, seats: ['C5'] }),
    reserveSlot('s-1', null, null, false, OTHER, null, tenant, { ...deps, seats: ['C5'] })
  ]);

  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  const rejected = results.find((r) => r.status === 'rejected');
  assert.equal(rejected.reason.status, 409);
  assert.match(rejected.reason.message, /vient d'être réservée/);
  assert.deepEqual(slot.takenSeats, ['C5']);
  assert.equal(slot.availableSeats, 39);
  assert.ok(events.some((e) => e.action === 'REJECTED_CONFLICT'));
});

test('reserveSlot sans places : placement automatique centré, nouvel essai si une place est prise entre-temps', async (t) => {
  const { slot, Slot, deps, tenant } = memorySlot(t);
  const realClaim = Slot.findOneAndUpdate;
  let calls = 0;
  t.mock.method(Slot, 'findOneAndUpdate', async (filter, update) => {
    calls += 1;
    if (calls === 1) {
      slot.takenSeats.push('C5');
      slot.availableSeats -= 1;
    }
    return realClaim(filter, update);
  });

  const booking = await reserveSlot('s-1', null, null, false, USER, [{ category: 'ADULT', quantity: 2 }], tenant, deps);
  assert.equal(calls, 2);
  assert.deepEqual(booking.seats, ['C6', 'C7']);
});

test('reserveSlot sur une salle complète → 409 REJECTED_FULL', async (t) => {
  const { deps, tenant, events } = memorySlot(t, { capacity: 2, availableSeats: 0, status: 'BOOKED', takenSeats: ['A1', 'A2'] });
  await assert.rejects(reserveSlot('s-1', null, null, false, USER, null, tenant, deps), { status: 409 });
  assert.equal(events.at(-1).action, 'REJECTED_FULL');
});

test('cancelSlot rend les places de la réservation', async (t) => {
  const { Slot, Booking, tenant } = memorySlot(t);
  Booking.findOneAndUpdate = () => query({ _id: 'b-1', ownerId: 'u-1', totalQuantity: 2, seats: ['B3', 'B4'] });
  const updates = [];
  t.mock.method(Slot, 'findOneAndUpdate', async (filter, update) => {
    updates.push(update);
    return { _id: 's-1', status: 'AVAILABLE', capacity: 40, availableSeats: 40, version: 2 };
  });

  await cancelSlot('s-1', USER, tenant);
  const pipeline = JSON.stringify(updates[0]);
  assert.ok(pipeline.includes('"$setDifference":[{"$ifNull":["$takenSeats",[]]},{"$literal":["B3","B4"]}]'));
});

test('getSeatMap renvoie le plan et les places prises', async (t) => {
  const { tenant } = memorySlot(t, { capacity: 24, takenSeats: ['B2'] });
  const map = await getSeatMap('s-1', tenant);
  assert.equal(map.layout.capacity, 24);
  assert.equal(map.layout.rows.length, 3);
  assert.deepEqual(map.taken, ['B2']);
});
