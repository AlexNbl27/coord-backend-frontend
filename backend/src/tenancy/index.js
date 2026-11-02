import mongoose from 'mongoose';
import { Slot } from '../models/Slot.js';
import { Booking } from '../models/Booking.js';

const RESERVED_SLUGS = new Set([
  'admin', 'api', 'www', 'master', 'cineslot', 'config', 'local',
  'static', 'assets', 'otlp', 'mail', 'auth', 'login', 'root', 'test'
]);

const SLUG_RE = /^[a-z](?:[a-z0-9]|-(?!-)){1,28}[a-z0-9]$/;

export function isValidSlug(s) {
  return typeof s === 'string' && SLUG_RE.test(s) && !RESERVED_SLUGS.has(s);
}

export function tenantDbName(slug) {
  return `cinema_${slug}`;
}

export function getTenantModels(db) {
  if (!db) {
    return { Slot, Booking };
  }
  return {
    Slot: db.models.Slot || db.model('Slot', Slot.schema),
    Booking: db.models.Booking || db.model('Booking', Booking.schema)
  };
}

export function useTenantDb(slug) {
  return mongoose.connection.useDb(tenantDbName(slug), { useCache: true });
}
