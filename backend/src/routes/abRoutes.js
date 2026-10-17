import { Router } from 'express';
import { EXP, isEnabled, assign, expose, getMetrics, simulateData } from '../services/abService.js';

export const abRouter = Router();

const COOKIE_NAME = 'ab_visitor';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 jour

/**
 * GET /api/ab/assignment
 * Affecte ou réutilise l'affectation du visiteur.
 * Dépose le cookie HTTP-Only ab_visitor si nécessaire (Lazy Write).
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
 * 204 No Content en cas de succès, 400 si visitorId invalide.
 */
abRouter.post('/exposure', async (req, res, next) => {
  try {
    const visitorId = req.cookies?.[COOKIE_NAME];
    await expose(visitorId);
    res.status(204).end();
  } catch (err) {
    if (err.status === 400 || err.status === 409) {
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * GET /api/ab/metrics
 * Retourne les statistiques consolidées du test A/B :
 * - Indicateurs par variante (assignés, exposés, convertis, taux, intervalle de confiance à 95%)
 * - Synthèse statistique globale (Z-score, p-value, significativité, lift, test SRM)
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

/**
 * POST /api/ab/simulate
 * Simule un jeu de données complet pour tester la robustesse et le verdict statistique
 */
abRouter.post('/simulate', async (req, res, next) => {
  try {
    const { countA, convA, countB, convB } = req.body || {};
    const result = await simulateData({ countA, convA, countB, convB });
    res.json({
      message: 'Données de test A/B simulées avec succès',
      metrics: result
    });
  } catch (err) {
    next(err);
  }
});
