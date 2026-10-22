import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTicket,
  CANCELLED_MESSAGE,
  NOT_FOUND_MESSAGE,
  ticketFilename
} from '../src/services/ticketService.js';
import { formatTicketTime } from '../src/utils/ticketFormatters.js';

const CONFIRMED_BOOKING = {
  _id: 'b7d1a2c3-4444-4444-8888-999988887777',
  slotId: 'slot-1',
  ownerId: 'spectator-1',
  ownerName: 'Hélène Durand',
  movieTitle: 'Interstellar',
  hall: 'Salle 1 · IMAX Laser',
  startsAt: '2026-11-24T08:30:00.000Z',
  seat: 'Rangée E · Fauteuil 12',
  status: 'CONFIRMED',
  bookedAt: new Date('2026-11-16T09:00:00.000Z')
};

test('ticketService: returns 404 when booking does not exist without rendering PDF', async () => {
  let rendered = false;
  await assert.rejects(
    () =>
      buildTicket('spectator-1', 'unknown-id', {
        findBookingById: async () => null,
        renderPdf: async () => {
          rendered = true;
          return Buffer.from('%PDF-1.4');
        }
      }),
    (err) => err.status === 404 && err.message === NOT_FOUND_MESSAGE
  );
  assert.equal(rendered, false);
});

test('ticketService: returns 404 (never 403) for another spectator without rendering PDF', async () => {
  let rendered = false;
  await assert.rejects(
    () =>
      buildTicket('spectator-2', CONFIRMED_BOOKING._id, {
        findBookingById: async () => CONFIRMED_BOOKING,
        renderPdf: async () => {
          rendered = true;
          return Buffer.from('%PDF-1.4');
        }
      }),
    (err) => err.status === 404 && err.message === NOT_FOUND_MESSAGE
  );
  assert.equal(rendered, false);
});

test('ticketService: returns 409 when booking is cancelled without rendering PDF', async () => {
  let rendered = false;
  await assert.rejects(
    () =>
      buildTicket('spectator-1', CONFIRMED_BOOKING._id, {
        findBookingById: async () => ({ ...CONFIRMED_BOOKING, status: 'CANCELLED' }),
        renderPdf: async () => {
          rendered = true;
          return Buffer.from('%PDF-1.4');
        }
      }),
    (err) => err.status === 409 && err.message === CANCELLED_MESSAGE
  );
  assert.equal(rendered, false);
});

test('ticketFormatters: formats Europe/Paris time accurately in winter and summer', () => {
  // Winter: UTC+1 -> 08:30Z = 9 h 30
  assert.equal(formatTicketTime('2026-11-24T08:30:00.000Z'), '9 h 30');
  // Summer: UTC+2 -> 07:30Z = 9 h 30
  assert.equal(formatTicketTime('2026-07-07T07:30:00.000Z'), '9 h 30');
});

test('ticketService: neutral filename contains only booking identifier', () => {
  const filename = ticketFilename('b7d1a2c3-4444-4444-8888-999988887777');
  assert.equal(filename, 'ticket-b7d1a2c3-444.pdf');
  assert.ok(!filename.includes('Interstellar'));
  assert.ok(!filename.includes('Durand'));
});
