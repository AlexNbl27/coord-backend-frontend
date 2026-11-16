import mongoose from 'mongoose';

const ticketLineSchema = new mongoose.Schema({
  category: { type: String, required: true },
  label: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 }
}, { _id: false });

const bookingSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  slotId: { type: String, required: true, index: true },
  ownerId: { type: String, required: true, index: true },
  ownerName: { type: String, required: true },
  movieTitle: { type: String, required: true },
  hall: { type: String, required: true },
  address: { type: String, default: '14 rue de la Cinémathèque, 69002 Lyon' },
  startsAt: { type: String, required: true },
  seat: { type: String, required: true },
  tickets: { type: [ticketLineSchema], default: [] },
  totalQuantity: { type: Number, default: 1 },
  totalAmount: { type: Number, default: 11.5 },
  status: {
    type: String,
    enum: ['CONFIRMED', 'CANCELLED'],
    default: 'CONFIRMED'
  },
  bookedAt: { type: Date, default: Date.now },
  cancelledAt: { type: Date, default: null }
}, {
  collection: 'bookings',
  versionKey: false
});

bookingSchema.index({ ownerId: 1, bookedAt: -1 });
bookingSchema.index({ slotId: 1, status: 1 });

export const Booking = mongoose.model('Booking', bookingSchema);
