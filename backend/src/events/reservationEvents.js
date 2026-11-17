import { EventEmitter } from 'node:events';
import { trace, isSpanContextValid } from '@opentelemetry/api';
import { ReservationLog, RESERVATION_ACTIONS } from '../models/ReservationLog.js';

export const RESERVATION_EVENT = 'reservation';
export { RESERVATION_ACTIONS };

const ACTIONS = new Set(RESERVATION_ACTIONS);

export const reservationBus = new EventEmitter();
reservationBus.setMaxListeners(20);

export function onReservationEvent(listener) {
  const safe = async (event) => {
    try {
      await listener(event);
    } catch (err) {
      console.error('[ReservationEvents] listener failed:', err.message);
    }
  };
  reservationBus.on(RESERVATION_EVENT, safe);
  return () => reservationBus.off(RESERVATION_EVENT, safe);
}

export function activeTraceId() {
  const ctx = trace.getActiveSpan()?.spanContext();
  return ctx && isSpanContextValid(ctx) ? ctx.traceId : null;
}

const toId = (value) => (value === undefined || value === null || value === '' ? null : String(value));

function toEntry(event, at) {
  if (!ACTIONS.has(event?.action)) {
    throw new TypeError(`Action de réservation inconnue : ${event?.action}`);
  }
  const quantity = Number(event.quantity);
  return {
    at,
    action: event.action,
    cinemaSlug: toId(event.cinemaSlug),
    slotId: toId(event.slotId),
    movieId: toId(event.movieId),
    bookingId: toId(event.bookingId),
    userId: toId(event.userId),
    quantity: Number.isInteger(quantity) && quantity >= 0 ? quantity : 0,
    traceId: toId(event.traceId) ?? activeTraceId(),
    reason: toId(event.reason)
  };
}

export function createReservationEmitter({ logs = ReservationLog, bus = reservationBus, now = () => new Date() } = {}) {
  return async function emitReservationEvent(event) {
    const entry = toEntry(event, now());
    try {
      await logs.create(entry);
    } catch (err) {
      console.error('[ReservationEvents] reservation_logs insert failed:', err.message);
    }
    bus.emit(RESERVATION_EVENT, Object.freeze({ ...entry }));
    return entry;
  };
}

export const emitReservationEvent = createReservationEmitter();
