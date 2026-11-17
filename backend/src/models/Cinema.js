import mongoose from 'mongoose';
import { RESERVED_SLUGS, SLUG_PATTERN, tenantDbName } from '../tenancy/slug.js';

const cinemaSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    immutable: true,
    match: SLUG_PATTERN,
    validate: {
      validator: (v) => !RESERVED_SLUGS.has(v),
      message: 'Slug de cinéma réservé.'
    }
  },
  dbName: { type: String, required: true, immutable: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  features: { type: [String], default: [] },
  status: { type: String, enum: ['ACTIVE', 'DISABLED', 'DELETED'], default: 'ACTIVE' },
  deletedAt: { type: Date, default: null },
  purgeState: { type: String, enum: ['PENDING', 'DONE'], default: null }
}, {
  collection: 'cinemas',
  versionKey: false
});

cinemaSchema.pre('validate', function setDbName(next) {
  if (!this.dbName && typeof this.slug === 'string' && SLUG_PATTERN.test(this.slug) && !RESERVED_SLUGS.has(this.slug)) {
    this.dbName = tenantDbName(this.slug);
  }
  next();
});

cinemaSchema.index({ latitude: 1, longitude: 1 });
cinemaSchema.index({ location: '2dsphere' });
cinemaSchema.index({ status: 1, deletedAt: 1 });

export const Cinema = mongoose.model('Cinema', cinemaSchema);
