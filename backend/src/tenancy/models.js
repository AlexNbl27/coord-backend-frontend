import { slotSchema } from '../models/Slot.js';
import { bookingSchema } from '../models/Booking.js';
import { tenantDbName } from './slug.js';
import { tenantConn } from './connections.js';

export function getTenantModels(db) {
  if (!db || typeof db.model !== 'function') {
    throw new TypeError('Connexion tenant requise.');
  }
  return {
    Slot: db.models.Slot || db.model('Slot', slotSchema),
    Booking: db.models.Booking || db.model('Booking', bookingSchema)
  };
}

export function useTenantDb(slug, conn = tenantConn) {
  return conn.useDb(tenantDbName(slug), { useCache: true });
}
