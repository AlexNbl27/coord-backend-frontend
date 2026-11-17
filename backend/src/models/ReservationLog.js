import mongoose from 'mongoose';
import { insertOnly } from './insertOnly.js';

export const RESERVATION_ACTIONS = Object.freeze([
  'BOOKED',
  'CANCELLED',
  'REJECTED_DISABLED',
  'REJECTED_FULL',
  'REJECTED_CONFLICT'
]);

const reservationLogSchema = new mongoose.Schema({
  at: { type: Date, required: true },
  action: { type: String, required: true, enum: RESERVATION_ACTIONS },
  cinemaSlug: { type: String, default: null },
  slotId: { type: String, default: null },
  movieId: { type: String, default: null },
  bookingId: { type: String, default: null },
  userId: { type: String, default: null },
  quantity: { type: Number, default: 0 },
  traceId: { type: String, default: null },
  reason: { type: String, default: null }
}, {
  collection: 'reservation_logs',
  versionKey: false
});

reservationLogSchema.index({ cinemaSlug: 1, at: -1 });
reservationLogSchema.index({ action: 1, at: -1 });
reservationLogSchema.index({ movieId: 1, at: -1 });
reservationLogSchema.index({ slotId: 1, at: -1 });

insertOnly(reservationLogSchema, 'reservation_logs');

export const ReservationLog = mongoose.model('ReservationLog', reservationLogSchema);
