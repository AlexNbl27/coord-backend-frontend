import mongoose from 'mongoose';

const bookingStatSchema = new mongoose.Schema({
  cinemaSlug: { type: String, required: true },
  movieId: { type: String, required: true },
  day: { type: String, required: true },
  booked: { type: Number, default: 0 },
  cancelled: { type: Number, default: 0 },
  seats: { type: Number, default: 0 },
  applied: { type: [String], default: [], select: false },
  recomputedAt: { type: Date }
}, {
  collection: 'booking_stats',
  versionKey: false
});

bookingStatSchema.index({ cinemaSlug: 1, movieId: 1, day: 1 }, { unique: true });
bookingStatSchema.index({ day: 1 });

export const BookingStat = mongoose.model('BookingStat', bookingStatSchema);
