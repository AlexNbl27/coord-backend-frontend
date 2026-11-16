import crypto from 'node:crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Slot } from '../models/Slot.js';
import { Booking } from '../models/Booking.js';
import { EXP, attribution } from './abService.js';
import { DEFAULT_CINEMA_ADDRESS, generateSeatLabel } from '../utils/ticketFormatters.js';

const tracer = trace.getTracer('cineslot-api');
const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || '';
const MAX_SSE_CLIENTS = 200;
const DEFAULT_CAPACITY = 40;
const MAX_TICKETS_PER_BOOKING = 10;

const TICKET_TARIFFS = new Map([
  ['ADULT', { category: 'ADULT', label: 'Adulte', unitPrice: 11.5 }],
  ['YOUTH', { category: 'YOUTH', label: 'Jeune (-26 ans)', unitPrice: 8.0 }],
  ['SENIOR', { category: 'SENIOR', label: 'Senior (65+)', unitPrice: 8.5 }],
  ['CHILD', { category: 'CHILD', label: 'Enfant (-14 ans)', unitPrice: 6.0 }]
]);

const sseClients = new Set();

const MOVIES_CATALOG = [
  { movieTitle: 'Interstellar', hall: 'Salle 1 · IMAX Laser', capacity: 40 },
  { movieTitle: 'Inception', hall: 'Salle 2 · Dolby Atmos', capacity: 36 },
  { movieTitle: 'Dune : Deuxième Partie', hall: 'Salle 1 · IMAX Laser', capacity: 40 },
  { movieTitle: 'Oppenheimer', hall: 'Salle 3 · 70mm Grand Large', capacity: 30 },
  { movieTitle: 'Blade Runner 2049', hall: 'Salle 4 · 4DX Immersion', capacity: 24 },
  { movieTitle: 'The Matrix', hall: 'Salle 5 · Rétro Culte', capacity: 28 }
];

function normalizeTickets(rawTickets) {
  if (!rawTickets || rawTickets.length === 0) {
    const adult = TICKET_TARIFFS.get('ADULT');
    return {
      lines: [{ ...adult, quantity: 1 }],
      totalQuantity: 1,
      totalAmount: adult.unitPrice
    };
  }

  const aggregated = new Map();
  for (const item of rawTickets) {
    if (!item || typeof item !== 'object') {
      const error = new Error('Format de billet invalide');
      error.status = 400;
      throw error;
    }
    const tariff = TICKET_TARIFFS.get(String(item.category || '').toUpperCase());
    if (!tariff) {
      const error = new Error('Catégorie de tarif inconnue');
      error.status = 400;
      throw error;
    }
    const qty = Number(item.quantity);
    if (!Number.isInteger(qty) || qty < 0 || qty > MAX_TICKETS_PER_BOOKING) {
      const error = new Error(`La quantité doit être comprise entre 0 et ${MAX_TICKETS_PER_BOOKING}`);
      error.status = 400;
      throw error;
    }
    if (qty > 0) {
      aggregated.set(tariff.category, (aggregated.get(tariff.category) || 0) + qty);
    }
  }

  const lines = [];
  let totalQuantity = 0;
  let totalAmount = 0;
  for (const [category, quantity] of aggregated.entries()) {
    const tariff = TICKET_TARIFFS.get(category);
    lines.push({ ...tariff, quantity });
    totalQuantity += quantity;
    totalAmount += tariff.unitPrice * quantity;
  }

  if (totalQuantity < 1 || totalQuantity > MAX_TICKETS_PER_BOOKING) {
    const error = new Error(`Vous devez sélectionner entre 1 et ${MAX_TICKETS_PER_BOOKING} places par réservation`);
    error.status = 400;
    throw error;
  }

  return {
    lines,
    totalQuantity,
    totalAmount: Math.round(totalAmount * 100) / 100
  };
}

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
  const capacity = slot.capacity ?? DEFAULT_CAPACITY;
  const availableSeats = slot.availableSeats ?? (slot.status === 'BOOKED' ? 0 : capacity);
  const payload = {
    slotId: slot._id,
    status: slot.status,
    version: slot.version,
    capacity,
    availableSeats
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
  const capacity = slot.capacity ?? DEFAULT_CAPACITY;
  const availableSeats = slot.availableSeats ?? (slot.status === 'BOOKED' ? 0 : capacity);
  return {
    id: slot._id,
    startsAt: slot.startsAt,
    status: availableSeats <= 0 ? 'BOOKED' : slot.status,
    version: slot.version,
    movieTitle: slot.movieTitle || 'Séance Cinéma',
    hall: slot.hall || 'Salle Principale',
    capacity,
    availableSeats
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
        capacity: m.capacity,
        availableSeats: m.capacity,
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

export async function reserveSlot(slotId, customerId, visitorId, isMeasured, sessionUser = null, rawTickets = null) {
  return tracer.startActiveSpan('cineslot.reservation', async (span) => {
    span.setAttribute('cineslot.slot.id', String(slotId));
    try {
      const { lines, totalQuantity, totalAmount } = normalizeTickets(rawTickets);

      const ownerId = sessionUser?.id || 'spectator-1';
      const safeCustomer = typeof customerId === 'string' ? customerId.trim().slice(0, 80) : '';
      const ownerName = sessionUser?.name || safeCustomer || 'Hélène Durand';

      const existingBooking = await Booking.findOne({
        slotId: String(slotId),
        ownerId,
        status: 'CONFIRMED'
      }).lean();
      if (existingBooking) {
        const error = new Error('Vous avez déjà une réservation active pour cette séance');
        error.status = 409;
        throw error;
      }

      let experimentId = null;
      let subjectId = null;
      if (isMeasured && visitorId) {
        const subject = await attribution(visitorId);
        if (subject) {
          experimentId = EXP;
          subjectId = subject._id;
        }
      }

      const bookingId = crypto.randomUUID();
      const bookedAt = new Date();

      const winner = await Slot.findOneAndUpdate(
        {
          _id: String(slotId),
          status: 'AVAILABLE',
          $expr: {
            $gte: [{ $ifNull: ['$availableSeats', { $ifNull: ['$capacity', DEFAULT_CAPACITY] }] }, totalQuantity]
          }
        },
        [
          {
            $set: {
              capacity: { $ifNull: ['$capacity', DEFAULT_CAPACITY] },
              availableSeats: {
                $subtract: [
                  { $ifNull: ['$availableSeats', { $ifNull: ['$capacity', DEFAULT_CAPACITY] }] },
                  totalQuantity
                ]
              },
              bookedBy: ownerName,
              bookingId,
              bookedAt,
              experimentId,
              subjectId,
              version: { $add: ['$version', 1] },
              claimCount: { $add: ['$claimCount', 1] },
              status: {
                $cond: [
                  {
                    $lte: [
                      {
                        $subtract: [
                          { $ifNull: ['$availableSeats', { $ifNull: ['$capacity', DEFAULT_CAPACITY] }] },
                          totalQuantity
                        ]
                      },
                      0
                    ]
                  },
                  'BOOKED',
                  'AVAILABLE'
                ]
              }
            }
          }
        ],
        { new: true }
      );

      if (!winner) {
        const current = await Slot.findById(String(slotId)).lean();
        if (!current) {
          const error = new Error('Créneau inconnu');
          error.status = 404;
          throw error;
        }
        const remaining = current.availableSeats ?? (current.status === 'BOOKED' ? 0 : DEFAULT_CAPACITY);
        const error = new Error(
          remaining <= 0 || current.status === 'BOOKED'
            ? 'Créneau déjà complet'
            : `Il ne reste que ${remaining} place(s) disponible(s) pour cette séance`
        );
        error.status = 409;
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
        tickets: lines,
        totalQuantity,
        totalAmount,
        status: 'CONFIRMED',
        bookedAt
      });

      dispatchSmsConfirmation(bookingId, winner._id);

      span.setAttribute('cineslot.reservation.id', String(bookingId));
      span.setAttribute('cineslot.status', String(winner.status));

      broadcastSlotChange(winner);
      return {
        bookingId,
        slotId: winner._id,
        status: winner.status,
        seat,
        tickets: lines,
        totalQuantity,
        totalAmount,
        availableSeats: winner.availableSeats,
        capacity: winner.capacity
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
  const bookingFilter = sessionUser
    ? { slotId: safeSlotId, ownerId: sessionUser.id, status: 'CONFIRMED' }
    : { slotId: safeSlotId, status: 'CONFIRMED' };

  const activeBooking = await Booking.findOne(bookingFilter).lean();
  if (!activeBooking) {
    const anyBooking = await Booking.findOne({ slotId: safeSlotId, status: 'CONFIRMED' }).lean();
    if (anyBooking && sessionUser && anyBooking.ownerId !== sessionUser.id) {
      const error = new Error('Vous ne pouvez pas annuler la réservation d\'un autre spectateur');
      error.status = 403;
      throw error;
    }
    const exists = await Slot.exists({ _id: safeSlotId });
    const error = new Error(exists ? 'Aucune réservation active à annuler' : 'Créneau inconnu');
    error.status = exists ? 400 : 404;
    throw error;
  }

  const restoreQty = activeBooking.totalQuantity || 1;
  await Booking.updateOne(
    { _id: activeBooking._id },
    { $set: { status: 'CANCELLED', cancelledAt: new Date() } }
  );

  const updated = await Slot.findOneAndUpdate(
    { _id: safeSlotId },
    [
      {
        $set: {
          status: 'AVAILABLE',
          capacity: { $ifNull: ['$capacity', DEFAULT_CAPACITY] },
          availableSeats: {
            $min: [
              { $ifNull: ['$capacity', DEFAULT_CAPACITY] },
              {
                $add: [
                  { $ifNull: ['$availableSeats', 0] },
                  restoreQty
                ]
              }
            ]
          },
          version: { $add: ['$version', 1] }
        }
      },
      { $unset: ['bookedBy', 'bookingId', 'bookedAt', 'experimentId', 'subjectId'] }
    ],
    { new: true }
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
    capacity: randomMovie.capacity,
    availableSeats: randomMovie.capacity,
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
    capacity: slot.capacity ?? DEFAULT_CAPACITY,
    availableSeats: slot.availableSeats ?? (slot.status === 'BOOKED' ? 0 : DEFAULT_CAPACITY),
    claimCount: slot.claimCount,
    version: slot.version,
    experimentId: slot.experimentId || null,
    attributed: Boolean(slot.subjectId)
  };
}

export async function resetAllSlots() {
  await Slot.updateMany({}, [
    {
      $set: {
        status: 'AVAILABLE',
        capacity: { $ifNull: ['$capacity', DEFAULT_CAPACITY] },
        availableSeats: { $ifNull: ['$capacity', DEFAULT_CAPACITY] },
        version: { $add: ['$version', 1] }
      }
    },
    { $unset: ['bookedBy', 'bookingId', 'bookedAt', 'experimentId', 'subjectId'] }
  ]);

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
