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

export const slotRouter = Router();

const COOKIE_NAME = 'ab_visitor';

/**
 * GET /api/slots/events
 * Flux SSE des mises à jour des créneaux en temps réel
 */
slotRouter.get('/events', (req, res) => {
  subscribeSse(req, res);
});

/**
 * GET /api/slots
 * Récupère la liste de tous les créneaux disponibles et réservés
 */
slotRouter.get('/', async (req, res, next) => {
  try {
    const slots = await allSlots();
    res.json(slots);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/slots/:id/reservations
 * Réserve un créneau. Gère l'attribution A/B si X-AB-Measure === 'true'
 */
slotRouter.post('/:id/reservations', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { customerId } = req.body;
    const visitorId = req.cookies?.[COOKIE_NAME];
    const isMeasured = req.headers['x-ab-measure'] === 'true';

    const booking = await reserveSlot(id, customerId, visitorId, isMeasured);
    res.status(201).json(booking);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
});

/**
 * DELETE /api/slots/:id/reservations
 * Annule une réservation
 */
slotRouter.delete('/:id/reservations', async (req, res, next) => {
  try {
    const { id } = req.params;
    const slot = await cancelSlot(id);
    res.json(slot);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/slots/lab
 * Génère un créneau aléatoire pour le test
 */
slotRouter.post('/lab', async (req, res, next) => {
  try {
    const demo = await createDemoSlot();
    res.status(201).json(demo);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/slots/:id/proof
 * Renvoie les informations de preuve d'un créneau
 */
slotRouter.get('/:id/proof', async (req, res, next) => {
  try {
    const { id } = req.params;
    const proof = await getSlotProof(id);
    res.json(proof);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/slots/reset
 * Réinitialise tous les créneaux pour qu'ils soient de nouveau disponibles
 */
slotRouter.post('/reset', async (req, res, next) => {
  try {
    const result = await resetAllSlots();
    res.json(result);
  } catch (err) {
    next(err);
  }
});
