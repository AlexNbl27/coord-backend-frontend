import crypto from 'node:crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Slot } from '../models/Slot.js';
import { Booking } from '../models/Booking.js';
import { EXP, attribution } from './abService.js';
import { DEFAULT_CINEMA_ADDRESS, generateSeatLabel } from '../utils/ticketFormatters.js';

const tracer = trace.getTracer('cineslot-api');
const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || '';
const MAX_SSE_CLIENTS = 200;

const sseClients = new Set();

const MOVIES_CATALOG = [
  { movieTitle: 'Interstellar', hall: 'Salle 1 · IMAX Laser' },
  { movieTitle: 'Inception', hall: 'Salle 2 · Dolby Atmos' },
  { movieTitle: 'Dune : Deuxième Partie', hall: 'Salle 1 · IMAX Laser' },
  { movieTitle: 'Oppenheimer', hall: 'Salle 3 · 70mm Grand Large' },
  { movieTitle: 'Blade Runner 2049', hall: 'Salle 4 · 4DX Immersion' },
  { movieTitle: 'The Matrix', hall: 'Salle 5 · Rétro Culte' }
];

function sendSseEvent(res, eventName, data) {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

export function subscribeSse(req, res) {
  if (sseClients.size >= MAX_SSE_CLIENTS) {
    res.status(503).json({ message: 'Limite de connexions temps réel atteinte.' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  sseClients.add(res);
  sendSseEvent(res, 'ready', { action: 'reload' });

  req.on('close', () => {
    sseClients.delete(res);
  });
}

function sendToLocalClients(eventName, data) {
  for (const client of sseClients) {
    try {
      sendSseEvent(client, eventName, data);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function broadcastSlotChange(slot) {
  const payload = {
    slotId: slot._id,
    status: slot.status,
    version: slot.version
  };

  sendToLocalClients('slot-updated', payload);

  if (process.send) {
    process.send({
      type: 'BROADCAST_SSE',
      eventName: 'slot-updated',
      payload,
      originPid: process.pid
    });
  }
}

if (process.on) {
  process.on('message', (msg) => {
    if (msg && msg.type === 'BROADCAST_SSE' && msg.originPid !== process.pid) {
      sendToLocalClients(msg.eventName, msg.payload);
    }
  });
}

setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': keepalive\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 15000).unref?.();

export function toSlotView(slot) {
  return {
    id: slot._id,
    startsAt: slot.startsAt,
    status: slot.status,
    version: slot.version,
    movieTitle: slot.movieTitle || 'Séance Cinéma',
    hall: slot.hall || 'Salle Principale'
  };
}

export async function seedInitialSlotsIfEmpty() {
  const count = await Slot.countDocuments();
  if (count === 0) {
    const now = new Date();
    const demoSlots = MOVIES_CATALOG.map((m, idx) => {
      const slotDate = new Date(now.getTime() + (idx + 1) * 2 * 3600 * 1000);
      return {
        _id: crypto.randomUUID(),
        startsAt: slotDate.toISOString(),
        status: 'AVAILABLE',
        movieTitle: m.movieTitle,
        hall: m.hall,
        version: 0,
        claimCount: 0
      };
    });
    await Slot.insertMany(demoSlots);
    console.log(`[Slots] Seeded ${demoSlots.length} initial slots.`);
  }
}

export async function allSlots() {
  await seedInitialSlotsIfEmpty();
  const slots = await Slot.find().sort({ startsAt: 1 }).lean();
  return slots.map(toSlotView);
}

function dispatchSmsConfirmation(bookingId, slotId) {
  if (!SMS_GATEWAY_URL) return;
  fetch(SMS_GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, slotId })
  }).catch((err) => {
    console.warn(`[SMS] Async delivery failed for ${bookingId}:`, err.message);
  });
}

export async function reserveSlot(slotId, customerId, visitorId, isMeasured, sessionUser = null) {
  return tracer.startActiveSpan('cineslot.reservation', async (span) => {
    span.setAttribute('cineslot.slot.id', String(slotId));
    try {
      let experimentId = null;
      let subjectId = null;

      if (isMeasured && visitorId) {
        const subject = await attribution(visitorId);
        if (subject) {
          experimentId = EXP;
          subjectId = subject._id;
        }
      }

      const ownerId = sessionUser?.id || 'spectator-1';
      const safeCustomer = typeof customerId === 'string' ? customerId.trim().slice(0, 80) : '';
      const ownerName = sessionUser?.name || safeCustomer || 'Hélène Durand';
      const bookingId = crypto.randomUUID();
      const bookedAt = new Date();

      const filter = { _id: String(slotId), status: 'AVAILABLE' };
      const update = {
        $set: {
          status: 'BOOKED',
          bookedBy: ownerName,
          bookingId,
          bookedAt,
          experimentId,
          subjectId
        },
        $inc: { version: 1, claimCount: 1 }
      };

      const winner = await Slot.findOneAndUpdate(filter, update, { new: true });
      if (!winner) {
        const exists = await Slot.exists({ _id: String(slotId) });
        const error = new Error(exists ? 'Créneau déjà réservé' : 'Créneau inconnu');
        error.status = exists ? 409 : 404;
        throw error;
      }

      const seat = generateSeatLabel(winner._id, bookingId);
      await Booking.create({
        _id: bookingId,
        slotId: winner._id,
        ownerId,
        ownerName,
        movieTitle: winner.movieTitle || 'Séance Cinéma',
        hall: winner.hall || 'Salle Principale',
        address: DEFAULT_CINEMA_ADDRESS,
        startsAt: winner.startsAt,
        seat,
        status: 'CONFIRMED',
        bookedAt
      });

      dispatchSmsConfirmation(winner.bookingId, winner._id);

      span.setAttribute('cineslot.reservation.id', String(winner.bookingId));
      span.setAttribute('cineslot.status', String(winner.status));

      broadcastSlotChange(winner);
      return {
        bookingId: winner.bookingId,
        slotId: winner._id,
        status: winner.status,
        seat
      };
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.name || 'ReservationError' });
      throw err;
    } finally {
      span.end();
    }
  });
}

export async function cancelSlot(slotId, sessionUser = null) {
  const safeSlotId = String(slotId);
  if (sessionUser) {
    const activeBooking = await Booking.findOne({ slotId: safeSlotId, status: 'CONFIRMED' }).lean();
    if (activeBooking && activeBooking.ownerId !== sessionUser.id) {
      const error = new Error('Vous ne pouvez pas annuler la réservation d\'un autre spectateur');
      error.status = 403;
      throw error;
    }
  }

  const filter = { _id: safeSlotId, status: 'BOOKED' };
  const update = {
    $set: { status: 'AVAILABLE' },
    $unset: { bookedBy: 1, bookingId: 1, bookedAt: 1, experimentId: 1, subjectId: 1 },
    $inc: { version: 1 }
  };

  const updated = await Slot.findOneAndUpdate(filter, update, { new: true });
  if (!updated) {
    const exists = await Slot.exists({ _id: safeSlotId });
    const error = new Error(exists ? 'Créneau non réservé ou déjà annulé' : 'Créneau inconnu');
    error.status = exists ? 400 : 404;
    throw error;
  }

  await Booking.updateMany(
    { slotId: safeSlotId, status: 'CONFIRMED' },
    { $set: { status: 'CANCELLED', cancelledAt: new Date() } }
  );

  broadcastSlotChange(updated);
  return toSlotView(updated);
}

export async function createDemoSlot() {
  const randomMovie = MOVIES_CATALOG[Math.floor(Math.random() * MOVIES_CATALOG.length)];
  const slotDate = new Date(Date.now() + 86400 * 1000);
  const slot = new Slot({
    _id: crypto.randomUUID(),
    startsAt: slotDate.toISOString(),
    status: 'AVAILABLE',
    movieTitle: randomMovie.movieTitle,
    hall: randomMovie.hall,
    version: 0,
    claimCount: 0
  });

  const saved = await slot.save();
  broadcastSlotChange(saved);
  return toSlotView(saved);
}

export async function getSlotProof(slotId) {
  const slot = await Slot.findById(String(slotId)).lean();
  if (!slot) {
    const error = new Error('Créneau inconnu');
    error.status = 404;
    throw error;
  }
  return {
    id: slot._id,
    hall: slot.hall || 'Salle Principale',
    status: slot.status,
    claimCount: slot.claimCount,
    version: slot.version,
    experimentId: slot.experimentId || null,
    attributed: Boolean(slot.subjectId)
  };
}

export async function resetAllSlots() {
  await Slot.updateMany({}, {
    $set: { status: 'AVAILABLE' },
    $unset: { bookedBy: 1, bookingId: 1, bookedAt: 1, experimentId: 1, subjectId: 1 },
    $inc: { version: 1 }
  });

  await Booking.updateMany(
    { status: 'CONFIRMED' },
    { $set: { status: 'CANCELLED', cancelledAt: new Date() } }
  );

  sendToLocalClients('ready', { action: 'reload' });
  if (process.send) {
    process.send({
      type: 'BROADCAST_SSE',
      eventName: 'ready',
      payload: { action: 'reload' },
      originPid: process.pid
    });
  }

  return { message: 'Tous les créneaux sont désormais disponibles.' };
}
