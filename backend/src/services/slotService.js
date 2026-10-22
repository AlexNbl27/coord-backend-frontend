import crypto from 'node:crypto';
import { trace, SpanStatusCode } from '@opentelemetry/api';
import { Slot } from '../models/Slot.js';
import { Movie } from '../models/Movie.js';
import { Booking } from '../models/Booking.js';
import { EXP, attribution } from './abService.js';
import { DEFAULT_CINEMA_ADDRESS, generateSeatLabel } from '../utils/ticketFormatters.js';

const tracer = trace.getTracer('cineslot-api');
const SMS_GATEWAY_URL = process.env.SMS_GATEWAY_URL || '';

// Liste des clients SSE connectés
const sseClients = new Set();

// Catalogue de séances de cinéma pour les créneaux
const MOVIES_CATALOG = [
  { movieTitle: 'Interstellar', hall: 'Salle 1 · IMAX Laser' },
  { movieTitle: 'Inception', hall: 'Salle 2 · Dolby Atmos' },
  { movieTitle: 'Dune : Deuxième Partie', hall: 'Salle 1 · IMAX Laser' },
  { movieTitle: 'Oppenheimer', hall: 'Salle 3 · 70mm Grand Large' },
  { movieTitle: 'Blade Runner 2049', hall: 'Salle 4 · 4DX Immersion' },
  { movieTitle: 'The Matrix', hall: 'Salle 5 · Rétro Culte' }
];

/**
 * Envoi d'un événement SSE formaté à un client
 */
function sendSseEvent(res, eventName, data) {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
  if (typeof res.flush === 'function') {
    res.flush();
  }
}

/**
 * Inscription d'un client au flux Server-Sent Events
 */
export function subscribeSse(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Désactive le buffering Nginx/Vite
  res.flushHeaders?.();

  sseClients.add(res);

  // Événement initial obligatoire : ready / reload
  sendSseEvent(res, 'ready', { action: 'reload' });

  req.on('close', () => {
    sseClients.delete(res);
  });
}

/**
 * Diffusion locale à tous les clients connectés au worker courant
 */
function sendToLocalClients(eventName, data) {
  for (const client of sseClients) {
    try {
      sendSseEvent(client, eventName, data);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Diffusion de la mise à jour d'un créneau à tous les clients SSE
 * Règle de confidentialité : uniquement slotId, status et version
 */
export function broadcastSlotChange(slot) {
  const payload = {
    slotId: slot._id,
    status: slot.status,
    version: slot.version
  };

  // 1. Envoi aux clients locaux
  sendToLocalClients('slot-updated', payload);

  // 2. Relais IPC aux autres workers si en cluster
  if (process.send) {
    process.send({
      type: 'BROADCAST_SSE',
      eventName: 'slot-updated',
      payload,
      originPid: process.pid
    });
  }
}

// Écoute des messages IPC provenant des autres workers du cluster
if (process.on) {
  process.on('message', (msg) => {
    if (msg && msg.type === 'BROADCAST_SSE' && msg.originPid !== process.pid) {
      sendToLocalClients(msg.eventName, msg.payload);
    }
  });
}

// Heartbeat périodique SSE (toutes les 15 secondes)
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(': keepalive\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 15000);

/**
 * Conversion du modèle Slot en SlotView
 */
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

/**
 * Initialisation automatique des créneaux par défaut si la base est vide
 */
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
    console.log(`[Slots] ${demoSlots.length} créneaux initiaux insérés en base de données.`);
  }
}

/**
 * Liste de tous les créneaux
 */
export async function allSlots() {
  await seedInitialSlotsIfEmpty();
  const slots = await Slot.find().sort({ startsAt: 1 }).lean();
  // Résolution T2 : une seule requête groupée ($in) au lieu d'une boucle N+1
  const titles = [...new Set(slots.map((s) => s.movieTitle).filter(Boolean))];
  if (titles.length > 0) {
    await Movie.find({ title: { $in: titles } }).select('_id title').lean();
  }
  return slots.map(toSlotView);
}

/**
 * Envoi asynchrone non-bloquant de la confirmation SMS (résolution T1)
 */
function dispatchSmsConfirmation(bookingId, slotId) {
  if (!SMS_GATEWAY_URL) return;
  fetch(SMS_GATEWAY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookingId, slotId })
  }).catch((err) => {
    console.warn(`[SMS] Échec asynchrone pour ${bookingId}:`, err.message);
  });
}

/**
 * Réservation d'un créneau avec attribution conditionnelle A/B et span métier OpenTelemetry
 */
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
      const ownerName = sessionUser?.name || customerId || 'Hélène Durand';
      const bookingId = crypto.randomUUID();
      const bookedAt = new Date();

      const filter = { _id: slotId, status: 'AVAILABLE' };
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
        const exists = await Slot.exists({ _id: slotId });
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

      // Résolution T1 : envoi SMS asynchrone pour ne pas bloquer la réponse HTTP
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
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Annulation d'une réservation
 */
export async function cancelSlot(slotId) {
  const filter = { _id: slotId, status: 'BOOKED' };
  const update = {
    $set: { status: 'AVAILABLE' },
    $unset: { bookedBy: 1, bookingId: 1, bookedAt: 1, experimentId: 1, subjectId: 1 },
    $inc: { version: 1 }
  };

  const updated = await Slot.findOneAndUpdate(filter, update, { new: true });
  if (!updated) {
    const exists = await Slot.exists({ _id: slotId });
    const error = new Error(exists ? 'Créneau non réservé ou déjà annulé' : 'Créneau inconnu');
    error.status = exists ? 400 : 404;
    throw error;
  }

  await Booking.updateMany(
    { slotId, status: 'CONFIRMED' },
    { $set: { status: 'CANCELLED', cancelledAt: new Date() } }
  );

  broadcastSlotChange(updated);
  return toSlotView(updated);
}

/**
 * Création d'une séance de démonstration (pour Lab / tests dynamiques)
 */
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

/**
 * Preuve de réservation (pour vérification des compteurs)
 */
export async function getSlotProof(slotId) {
  const slot = await Slot.findById(slotId).lean();
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
    bookingId: slot.bookingId || '',
    experimentId: slot.experimentId || null,
    subjectId: slot.subjectId || null
  };
}

/**
 * Réinitialisation de tous les créneaux au statut AVAILABLE
 */
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

  // Notifie tous les clients SSE connectés de recharger leurs listes
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
