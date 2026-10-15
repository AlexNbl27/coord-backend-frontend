import { Router } from 'express';
import { EXP, isEnabled, assign, expose, getMetrics } from '../services/abService.js';

export const abRouter = Router();

const COOKIE_NAME = 'ab_visitor';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 jour

/**
 * GET /api/ab/assignment
 * Affecte ou réutilise l'affectation du visiteur.
 * Dépose le cookie HTTP-Only ab_visitor si nécessaire.
 */
abRouter.get('/assignment', async (req, res, next) => {
  try {
    if (!isEnabled()) {
      return res.json({
        experimentId: EXP,
        variant: 'A',
        enabled: false
      });
    }

    const visitorId = req.cookies?.[COOKIE_NAME];
    const subject = await assign(visitorId);

    // Si le cookie était absent ou invalide, on le positionne sur la réponse
    if (!visitorId || visitorId !== subject.visitorId) {
      res.cookie(COOKIE_NAME, subject.visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/api',
        maxAge: COOKIE_MAX_AGE_MS
      });
    }

    res.json({
      experimentId: EXP,
      variant: subject.variant,
      enabled: true
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ab/exposure
 * Enregistre l'exposition du visiteur (au moins un bouton de réservation disponible rendu).
 * 204 No Content en cas de succès, 409 si aucune affectation n'existe.
 */
abRouter.post('/exposure', async (req, res, next) => {
  try {
    const visitorId = req.cookies?.[COOKIE_NAME];
    await expose(visitorId);
    res.status(204).end();
  } catch (err) {
    if (err.status === 409) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/ab/metrics
 * Retourne les statistiques du test A/B : assignés, exposés, convertis, taux de conversion.
 */
abRouter.get('/metrics', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const metrics = await getMetrics();
    res.json(metrics);
  } catch (err) {
    next(err);
  }
});
