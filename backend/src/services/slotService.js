import crypto from 'node:crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Cinema } from '../models/Cinema.js';
import { Movie } from '../models/Movie.js';
import { getTenantModels } from '../tenancy/index.js';
import { getCinemaStatus } from './cinemaStatusService.js';
import { EXP, attribution } from './abService.js';
import { generateSeatLabel } from '../utils/ticketFormatters.js';
import { sendProblem } from './sessionService.js';
import { SSE_BROADCAST_TYPE, isValidSseBroadcast } from './sseMessages.js';
import { emitReservationEvent } from '../events/reservationEvents.js';

const tracer = trace.getTracer('cineslot-api');
const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || '';
const MAX_SSE_CLIENTS = Number(process.env.SSE_MAX_CLIENTS) || 200;
const MAX_SSE_PER_IP = Number(process.env.SSE_MAX_PER_IP) || 10;
const DEFAULT_CAPACITY = 40;
const MAX_TICKETS_PER_BOOKING = 10;

const TICKET_TARIFFS = new Map([
  ['ADULT', { category: 'ADULT', label: 'Adulte', unitPrice: 11.5 }],
  ['YOUTH', { category: 'YOUTH', label: 'Jeune (-26 ans)', unitPrice: 8.0 }],
  ['SENIOR', { category: 'SENIOR', label: 'Senior (65+)', unitPrice: 8.5 }],
  ['CHILD', { category: 'CHILD', label: 'Enfant (-14 ans)', unitPrice: 6.0 }]
]);

const sseClientsBySlug = new Map();
const sseConnectionsByIp = new Map();
let sseClientCount = 0;

const MOVIES_CATALOG = [
  { movieTitle: 'Interstellar', hall: 'Salle 1 · IMAX Laser', capacity: 40 },
  { movieTitle: 'Inception', hall: 'Salle 2 · Dolby Atmos', capacity: 36 },
  { movieTitle: 'Dune : Deuxième Partie', hall: 'Salle 1 · IMAX Laser', capacity: 40 },
  { movieTitle: 'Oppenheimer', hall: 'Salle 3 · 70mm Grand Large', capacity: 30 },
  { movieTitle: 'Blade Runner 2049', hall: 'Salle 4 · 4DX Immersion', capacity: 24 },
  { movieTitle: 'The Matrix', hall: 'Salle 5 · Rétro Culte', capacity: 28 }
];

function tenantModels(tenant) {
  return getTenantModels(tenant?.db);
}

export async function getCinemaAddress(slug) {
  if (!slug) {
    return '';
  }
  const cinema = await Cinema.findOne({ slug }, 'address city').lean();
  if (!cinema) {
    return '';
  }
  return [cinema.address, cinema.city].filter(Boolean).join(', ');
}

async function findCatalogMovieIds(titles) {
  const movies = await Movie.find({ title: { $in: titles } }, '_id title').lean();
  return new Map(movies.map((m) => [m.title, m._id]));
}

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
  if (typeof res.flush === 'function') res.flush();
}

function releaseSseClient(slug, res) {
  const clients = sseClientsBySlug.get(slug);
  const ip = clients?.get(res);
  if (ip === undefined || !clients.delete(res)) return;
  if (clients.size === 0) {
    sseClientsBySlug.delete(slug);
  }
  sseClientCount -= 1;
  const count = (sseConnectionsByIp.get(ip) ?? 1) - 1;
  if (count <= 0) {
    sseConnectionsByIp.delete(ip);
  } else {
    sseConnectionsByIp.set(ip, count);
  }
}

export function subscribeSse(req, res) {
  const slug = req.tenant?.slug;
  if (!slug) return sendProblem(res, 404, 'Not Found', 'Aucun cinéma ne correspond à cette adresse.');
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if ((sseConnectionsByIp.get(ip) ?? 0) >= MAX_SSE_PER_IP) {
    res.setHeader('Retry-After', '30');
    return sendProblem(res, 429, 'Too Many Requests', 'Trop de connexions temps réel ouvertes depuis cette adresse.');
  }
  if (sseClientCount >= MAX_SSE_CLIENTS) {
    res.setHeader('Retry-After', '30');
    return sendProblem(res, 503, 'Service Unavailable', 'Limite de connexions temps réel atteinte.');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  if (!sseClientsBySlug.has(slug)) {
    sseClientsBySlug.set(slug, new Map());
  }
  sseClientsBySlug.get(slug).set(res, ip);
  sseClientCount += 1;
  sseConnectionsByIp.set(ip, (sseConnectionsByIp.get(ip) ?? 0) + 1);

  req.on('close', () => releaseSseClient(slug, res));

  try {
    sendSseEvent(res, 'ready', { action: 'reload' });
    sendSseEvent(res, 'cinema-status', { slug, status: req.tenant.status ?? 'ACTIVE' });
  } catch {
    releaseSseClient(slug, res);
  }
}

function sendToTenantClients(slug, eventName, data) {
  const clients = sseClientsBySlug.get(slug);
  if (!clients) return;
  for (const client of [...clients.keys()]) {
    try {
      sendSseEvent(client, eventName, data);
    } catch {
      releaseSseClient(slug, client);
    }
  }
}

function broadcastToTenant(slug, eventName, payload) {
  const msg = { type: SSE_BROADCAST_TYPE, slug, eventName, payload, originPid: process.pid };
  if (!isValidSseBroadcast(msg)) return;
  sendToTenantClients(slug, eventName, payload);
  if (process.send) {
    process.send(msg);
  }
}

export function broadcastSlotChange(slot, slug) {
  const capacity = slot.capacity ?? DEFAULT_CAPACITY;
  const availableSeats = slot.availableSeats ?? (slot.status === 'BOOKED' ? 0 : capacity);
  broadcastToTenant(slug, 'slot-updated', {
    slotId: slot._id,
    status: slot.status,
    version: slot.version,
    capacity,
    availableSeats
  });
}

export function broadcastCinemaStatus(slug, status) {
  broadcastToTenant(slug, 'cinema-status', { slug, status });
}

export function getSseStats() {
  return {
    total: sseClientCount,
    bySlug: Object.fromEntries([...sseClientsBySlug].map(([slug, set]) => [slug, set.size])),
    byIp: Object.fromEntries(sseConnectionsByIp)
  };
}

if (process.on) {
  process.on('message', (msg) => {
    if (isValidSseBroadcast(msg) && msg.originPid !== process.pid) {
      sendToTenantClients(msg.slug, msg.eventName, msg.payload);
    }
  });
}

setInterval(() => {
  for (const [slug, clients] of [...sseClientsBySlug]) {
    for (const client of [...clients.keys()]) {
      try {
        client.write(': keepalive\n\n');
      } catch {
        releaseSseClient(slug, client);
      }
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
    movieId: slot.movieId ? String(slot.movieId) : null,
    capacity,
    availableSeats
  };
}

export async function seedInitialSlotsIfEmpty(tenant) {
  const { Slot } = tenantModels(tenant);
  const count = await Slot.countDocuments();
  if (count === 0) {
    const now = new Date();
    const movieIds = await findCatalogMovieIds(MOVIES_CATALOG.map((m) => m.movieTitle));
    const demoSlots = MOVIES_CATALOG.map((m, idx) => {
      const slotDate = new Date(now.getTime() + (idx + 1) * 2 * 3600 * 1000);
      return {
        _id: crypto.randomUUID(),
        startsAt: slotDate.toISOString(),
        status: 'AVAILABLE',
        movieId: movieIds.get(m.movieTitle) ?? null,
        movieTitle: m.movieTitle,
        hall: m.hall,
        capacity: m.capacity,
        availableSeats: m.capacity,
        version: 0,
        claimCount: 0
      };
    });
    await Slot.insertMany(demoSlots);
    console.log(`[Slots] Seeded ${demoSlots.length} initial slots for ${tenant.slug}.`);
  }
}

export async function allSlots(tenant) {
  await seedInitialSlotsIfEmpty(tenant);
  const { Slot } = tenantModels(tenant);
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

export async function reserveSlot(slotId, customerId, visitorId, isMeasured, sessionUser = null, rawTickets = null, tenant = null, deps = {}) {
  return tracer.startActiveSpan('cineslot.reservation', async (span) => {
    span.setAttribute('cineslot.slot.id', String(slotId));
    try {
      const checkStatus = deps.getCinemaStatus || getCinemaStatus;
      const resolveAddress = deps.getCinemaAddress || getCinemaAddress;

      const { lines, totalQuantity, totalAmount } = normalizeTickets(rawTickets);

      const ownerId = sessionUser?.id || 'spectator-1';
      const safeCustomer = typeof customerId === 'string' ? customerId.trim().slice(0, 80) : '';
      const ownerName = sessionUser?.name || safeCustomer || 'Hélène Durand';
      const logEvent = (action, extra = {}) => emitReservationEvent({
        action,
        cinemaSlug: tenant?.slug ?? null,
        slotId: String(slotId),
        userId: ownerId,
        quantity: totalQuantity,
        ...extra
      });

      const currentStatus = await checkStatus(tenant?.slug);
      if (currentStatus !== 'ACTIVE') {
        await logEvent('REJECTED_DISABLED');
        const error = new Error('Ce cinéma est temporairement désactivé.');
        error.status = 423;
        throw error;
      }

      const models = deps.Slot && deps.Booking ? deps : tenantModels(tenant);
      const SlotModel = models.Slot;
      const BookingModel = models.Booking;

      const existingBooking = await BookingModel.findOne({
        slotId: String(slotId),
        ownerId,
        status: 'CONFIRMED'
      }).lean();
      if (existingBooking) {
        await logEvent('REJECTED_CONFLICT', { bookingId: existingBooking._id, movieId: existingBooking.movieId });
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

      const winner = await SlotModel.findOneAndUpdate(
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
        const current = await SlotModel.findById(String(slotId)).lean();
        if (!current) {
          const error = new Error('Créneau inconnu');
          error.status = 404;
          throw error;
        }
        await logEvent('REJECTED_FULL', { movieId: current.movieId });
        const remaining = current.availableSeats ?? (current.status === 'BOOKED' ? 0 : DEFAULT_CAPACITY);
        const error = new Error(
          remaining <= 0 || current.status === 'BOOKED'
            ? 'Créneau déjà complet'
            : `Il ne reste que ${remaining} place(s) disponible(s) pour cette séance`
        );
        error.status = 409;
        throw error;
      }

      const seat = generateSeatLabel(winner._id, bookingId, totalQuantity);
      const address = await resolveAddress(tenant.slug);
      try {
        await BookingModel.create({
          _id: bookingId,
          slotId: winner._id,
          ownerId,
          ownerName,
          movieId: winner.movieId ?? null,
          movieTitle: winner.movieTitle || 'Séance Cinéma',
          hall: winner.hall || 'Salle Principale',
          address,
          startsAt: winner.startsAt,
          seat,
          tickets: lines,
          totalQuantity,
          totalAmount,
          status: 'CONFIRMED',
          bookedAt
        });
      } catch (err) {
        if (err?.code !== 11000) throw err;
        await releaseSeats(winner._id, totalQuantity, { Slot: SlotModel, Booking: BookingModel }, tenant?.slug);
        await logEvent('REJECTED_CONFLICT', { movieId: winner.movieId });
        const error = new Error('Vous avez déjà une réservation active pour cette séance');
        error.status = 409;
        throw error;
      }

      await logEvent('BOOKED', { bookingId, movieId: winner.movieId });

      dispatchSmsConfirmation(bookingId, winner._id);

      span.setAttribute('cineslot.reservation.id', String(bookingId));
      span.setAttribute('cineslot.status', String(winner.status));

      broadcastSlotChange(winner, tenant.slug);
      return {
        bookingId,
        slotId: winner._id,
        movieId: winner.movieId ?? null,
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

export async function cancelSlot(slotId, sessionUser, tenant) {
  const { Slot, Booking } = tenantModels(tenant);
  const safeSlotId = String(slotId);
  const bookingFilter = sessionUser
    ? { slotId: safeSlotId, ownerId: sessionUser.id, status: 'CONFIRMED' }
    : { slotId: safeSlotId, status: 'CONFIRMED' };

  const activeBooking = await Booking.findOneAndUpdate(
    bookingFilter,
    { $set: { status: 'CANCELLED', cancelledAt: new Date() } }
  ).lean();
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
  const updated = await releaseSeats(safeSlotId, restoreQty, { Slot, Booking }, tenant?.slug);

  await emitReservationEvent({
    action: 'CANCELLED',
    cinemaSlug: tenant?.slug ?? null,
    slotId: safeSlotId,
    movieId: activeBooking.movieId ?? updated?.movieId,
    bookingId: activeBooking._id,
    userId: activeBooking.ownerId,
    quantity: restoreQty
  });

  return toSlotView(updated);
}

async function releaseSeats(slotId, restoreQty, models, tenantSlug) {
  const safeSlotId = String(slotId);
  const remainingActive = await models.Booking.countDocuments({ slotId: safeSlotId, status: 'CONFIRMED' });

  const pipeline = [
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
    }
  ];
  if (remainingActive === 0) {
    pipeline.push({ $unset: ['bookedBy', 'bookingId', 'bookedAt', 'experimentId', 'subjectId'] });
  }

  const updated = await models.Slot.findOneAndUpdate(
    { _id: safeSlotId },
    pipeline,
    { new: true }
  );

  broadcastSlotChange(updated, tenantSlug);
  return updated;
}

export async function createDemoSlot(tenant) {
  const { Slot } = tenantModels(tenant);
  const randomMovie = MOVIES_CATALOG[Math.floor(Math.random() * MOVIES_CATALOG.length)];
  const slotDate = new Date(Date.now() + 86400 * 1000);
  const movieIds = await findCatalogMovieIds([randomMovie.movieTitle]);
  const slot = new Slot({
    _id: crypto.randomUUID(),
    startsAt: slotDate.toISOString(),
    status: 'AVAILABLE',
    movieId: movieIds.get(randomMovie.movieTitle) ?? null,
    movieTitle: randomMovie.movieTitle,
    hall: randomMovie.hall,
    capacity: randomMovie.capacity,
    availableSeats: randomMovie.capacity,
    version: 0,
    claimCount: 0
  });

  const saved = await slot.save();
  broadcastSlotChange(saved, tenant.slug);
  return toSlotView(saved);
}

export async function getSlotProof(slotId, tenant) {
  const { Slot } = tenantModels(tenant);
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

export async function resetAllSlots(tenant) {
  const { Slot, Booking } = tenantModels(tenant);
  const activeBookings = await Booking.find({ status: 'CONFIRMED' })
    .select('_id slotId ownerId movieId totalQuantity')
    .lean();
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
    { _id: { $in: activeBookings.map((b) => b._id) }, status: 'CONFIRMED' },
    { $set: { status: 'CANCELLED', cancelledAt: new Date() } }
  );

  for (const booking of activeBookings) {
    await emitReservationEvent({
      action: 'CANCELLED',
      cinemaSlug: tenant?.slug ?? null,
      slotId: booking.slotId,
      movieId: booking.movieId,
      bookingId: booking._id,
      userId: booking.ownerId,
      quantity: booking.totalQuantity || 1
    });
  }

  broadcastToTenant(tenant.slug, 'ready', { action: 'reload' });

  return { message: 'Tous les créneaux sont désormais disponibles.' };
}
