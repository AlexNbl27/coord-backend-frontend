import { Router } from 'express';
import { requireRole, sendProblem } from '../services/sessionService.js';
import { buildStatsQuery, queryBookingStats } from '../stats/bookingStats.js';

export function createAdminStatsRouter({ query = queryBookingStats } = {}) {
  const router = Router();

  router.get('/bookings', requireRole('SUPER_ADMIN', 'CINEMA_ADMIN'), async (req, res, next) => {
    const params = buildStatsQuery(req.query, req.sessionUser);
    if (params.status) {
      return sendProblem(res, params.status, params.status === 403 ? 'Forbidden' : 'Bad Request', params.detail);
    }
    try {
      res.setHeader('Cache-Control', 'no-store');
      return res.json(await query(params));
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export const adminStatsRouter = createAdminStatsRouter();
