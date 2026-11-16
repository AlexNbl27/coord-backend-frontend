import { Router } from 'express';
import {
  DEMO_SPECTATORS,
  SESSION_COOKIE_NAME,
  buildProblemDetail,
  findSpectatorById,
  getSessionCookieOptions,
  signSessionToken
} from '../services/sessionService.js';

export const sessionRouter = Router();

/**
 * GET /api/session
 * Returns current authenticated spectator and available demo accounts.
 */
sessionRouter.get('/', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    authenticated: Boolean(req.sessionUser),
    user: req.sessionUser ?? null,
    demoUsers: DEMO_SPECTATORS
  });
});

/**
 * POST /api/session/login
 * Signs in as one of the demo spectators and sets an HttpOnly SameSite=Lax cookie.
 */
sessionRouter.post('/login', (req, res) => {
  const userId = req.body?.userId || 'spectator-1';
  const spectator = findSpectatorById(userId);
  if (!spectator) {
    return res
      .status(400)
      .type('application/problem+json')
      .json(buildProblemDetail(400, 'Bad Request', 'Compte spectateur inconnu.'));
  }

  const token = signSessionToken(spectator.id);
  res.cookie(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return res.json({
    authenticated: true,
    user: spectator
  });
});

/**
 * POST /api/session/logout
 * Clears the spectator session cookie.
 */
sessionRouter.post('/logout', (_req, res) => {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/api' });
  return res.status(204).end();
});
