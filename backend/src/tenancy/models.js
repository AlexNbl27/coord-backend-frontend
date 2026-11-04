import mongoose from 'mongoose';
import { Slot } from '../models/Slot.js';
import { Booking } from '../models/Booking.js';
import { tenantDbName } from './slug.js';

export function getTenantModels(db) {
  if (!db || typeof db.model !== 'function') {
    throw new TypeError('Connexion tenant requise.');
  }
  return {
    Slot: db.models.Slot || db.model('Slot', Slot.schema),
    Booking: db.models.Booking || db.model('Booking', Booking.schema)
  };
}

export function useTenantDb(slug, conn = mongoose.connection) {
  return conn.useDb(tenantDbName(slug), { useCache: true });
}
