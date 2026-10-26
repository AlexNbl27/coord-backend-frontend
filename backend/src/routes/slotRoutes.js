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
import { requireSession } from '../services/sessionService.js';
import { isPlainString, isValidEntityId } from '../utils/securityMiddleware.js';

export const slotRouter = Router();

const COOKIE_NAME = 'ab_visitor';

slotRouter.get('/events', (req, res) => {
  subscribeSse(req, res);
});

slotRouter.get('/', async (_req, res, next) => {
  try {
    const slots = await allSlots();
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

slotRouter.post('/:id/reservations', async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidEntityId(id)) {
      return res.status(400).json({ message: 'Identifiant de créneau invalide' });
    }
    const rawCustomerId = req.body?.customerId;
    if (rawCustomerId !== undefined && !isPlainString(rawCustomerId, 100)) {
      return res.status(400).json({ message: 'Identifiant client invalide' });
    }
    const visitorId = req.cookies?.[COOKIE_NAME];
    const isMeasured = req.headers['x-ab-measure'] === 'true';
    const rawTickets = Array.isArray(req.body?.tickets) ? req.body.tickets : null;

    const booking = await reserveSlot(id, rawCustomerId, visitorId, isMeasured, req.sessionUser, rawTickets);
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
    const slot = await cancelSlot(id, req.sessionUser);
    return res.json(slot);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    return next(err);
  }
});

slotRouter.post('/lab', requireSession, async (_req, res, next) => {
  try {
    const demo = await createDemoSlot();
    res.status(201).json(demo);
  } catch (err) {
    next(err);
  }
});

slotRouter.get('/:id/proof', requireSession, async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!isValidEntityId(id)) {
      return res.status(400).json({ message: 'Identifiant de créneau invalide' });
    }
    const proof = await getSlotProof(id);
    return res.json(proof);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    return next(err);
  }
});

slotRouter.post('/reset', requireSession, async (_req, res, next) => {
  try {
    const result = await resetAllSlots();
    res.json(result);
  } catch (err) {
    next(err);
  }
});
