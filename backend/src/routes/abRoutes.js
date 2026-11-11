import { Router } from 'express';
import { EXP, isEnabled, assign, expose, getMetrics, simulateData } from '../services/abService.js';
import { allowInsecureCookies, requireRole } from '../services/sessionService.js';
import { requireTenant } from '../tenancy/index.js';
import { areDemoRoutesEnabled } from '../utils/securityMiddleware.js';
import { auditRequest } from '../events/audit.js';

const COOKIE_NAME = 'ab_visitor';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function createAbRouter({ demoRoutes = areDemoRoutesEnabled() } = {}) {
  const abRouter = Router();

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

      if (!visitorId || visitorId !== subject.visitorId) {
        res.cookie(COOKIE_NAME, subject.visitorId, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production' && !allowInsecureCookies(),
          sameSite: 'lax',
          path: '/api',
          maxAge: COOKIE_MAX_AGE_MS
        });
      }

      return res.json({
        experimentId: EXP,
        variant: subject.variant,
        enabled: true
      });
    } catch (err) {
      return next(err);
    }
  });

  abRouter.post('/exposure', async (req, res, next) => {
    try {
      const visitorId = req.cookies?.[COOKIE_NAME];
      await expose(visitorId);
      return res.status(204).end();
    } catch (err) {
      if (err.status === 400 || err.status === 409) {
        return res.status(err.status).json({ error: err.message });
      }
      return next(err);
    }
  });

  abRouter.get('/metrics', requireRole('SUPER_ADMIN'), requireTenant, async (req, res, next) => {
    try {
      res.setHeader('Cache-Control', 'no-store');
      const metrics = await getMetrics(req.tenant);
      res.json(metrics);
    } catch (err) {
      next(err);
    }
  });

  if (demoRoutes) {
    abRouter.post('/simulate', requireRole('SUPER_ADMIN'), requireTenant, async (req, res, next) => {
      try {
        const clamp = (val, def) => {
          const n = Number.parseInt(String(val ?? def), 10);
          return Number.isNaN(n) ? def : Math.min(Math.max(n, 0), 500);
        };
        const countA = clamp(req.body?.countA, 80);
        const convA = Math.min(clamp(req.body?.convA, 16), countA);
        const countB = clamp(req.body?.countB, 80);
        const convB = Math.min(clamp(req.body?.convB, 30), countB);

        const result = await simulateData({ countA, convA, countB, convB }, req.tenant);
        await auditRequest(req, 'AB_SIMULATE', {
          target: { type: 'experiment', id: EXP },
          after: { countA, convA, countB, convB }
        });
        res.json({
          message: 'Données de test A/B simulées avec succès',
          metrics: result
        });
      } catch (err) {
        next(err);
      }
    });
  }

  return abRouter;
}

export const abRouter = createAbRouter();
