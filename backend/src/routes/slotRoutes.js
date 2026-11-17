import { Router } from 'express';
import {
  allSlots,
  reserveSlot,
  cancelSlot,
  subscribeSse,
  createDemoSlot,
  getSlotProof,
  resetAllSlots
} from '../services/slotService.js';
import { requireRole, requireSession } from '../services/sessionService.js';
import { areDemoRoutesEnabled, isValidEntityId } from '../utils/securityMiddleware.js';
import { auditRequest } from '../events/audit.js';

const COOKIE_NAME = 'ab_visitor';

export function createSlotRouter({ demoRoutes = areDemoRoutesEnabled() } = {}) {
  const slotRouter = Router();

  slotRouter.get('/events', (req, res) => {
    subscribeSse(req, res);
  });

  slotRouter.get('/', async (req, res, next) => {
    try {
      const slots = await allSlots(req.tenant);
      res.json(slots);
    } catch (err) {
      next(err);
    }
  });

  slotRouter.post('/:id/reservations', requireSession, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidEntityId(id)) {
        return res.status(400).json({ message: 'Identifiant de créneau invalide' });
      }
      const visitorId = req.cookies?.[COOKIE_NAME];
      const isMeasured = req.headers['x-ab-measure'] === 'true';
      const rawTickets = Array.isArray(req.body?.tickets) ? req.body.tickets : null;

      const booking = await reserveSlot(id, req.body?.customerId ?? null, visitorId, isMeasured, req.sessionUser, rawTickets, req.tenant);
      return res.status(201).json(booking);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      return next(err);
    }
  });

  slotRouter.delete('/:id/reservations', requireSession, async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidEntityId(id)) {
        return res.status(400).json({ message: 'Identifiant de créneau invalide' });
      }
      const slot = await cancelSlot(id, req.sessionUser, req.tenant);
      return res.json(slot);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      return next(err);
    }
  });

  slotRouter.get('/:id/proof', requireRole('SUPER_ADMIN'), async (req, res, next) => {
    try {
      const { id } = req.params;
      if (!isValidEntityId(id)) {
        return res.status(400).json({ message: 'Identifiant de créneau invalide' });
      }
      const proof = await getSlotProof(id, req.tenant);
      return res.json(proof);
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({ message: err.message });
      }
      return next(err);
    }
  });

  if (demoRoutes) {
    slotRouter.post('/lab', requireRole('SUPER_ADMIN'), async (req, res, next) => {
      try {
        const demo = await createDemoSlot(req.tenant);
        await auditRequest(req, 'SLOT_LAB_CREATE', {
          target: { type: 'slot', id: demo.id, cinemaSlug: req.tenant?.slug ?? null },
          after: demo
        });
        res.status(201).json(demo);
      } catch (err) {
        next(err);
      }
    });

    slotRouter.post('/reset', requireRole('SUPER_ADMIN'), async (req, res, next) => {
      try {
        const result = await resetAllSlots(req.tenant);
        await auditRequest(req, 'SLOTS_RESET', {
          target: { type: 'slots', id: '*', cinemaSlug: req.tenant?.slug ?? null }
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    });
  }

  return slotRouter;
}

export const slotRouter = createSlotRouter();
