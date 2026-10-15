import mongoose from 'mongoose';

const slotSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  startsAt: { type: String, required: true },
  status: { type: String, enum: ['AVAILABLE', 'BOOKED'], default: 'AVAILABLE' },
  movieTitle: { type: String, default: 'Interstellar' },
  hall: { type: String, default: 'Salle 1 - IMAX Laser' },
  bookingId: { type: String, default: null },
  bookedBy: { type: String, default: null },
  bookedAt: { type: Date, default: null },
  experimentId: { type: String, default: null },
  subjectId: { type: String, default: null },
  version: { type: Number, default: 0 },
  claimCount: { type: Number, default: 0 }
}, {
  collection: 'slots',
  versionKey: false
});

export const Slot = mongoose.model('Slot', slotSchema);
