import { Router } from 'express';
import { buildProblemDetail, requireSession } from '../services/sessionService.js';
import { buildTicket } from '../services/ticketService.js';
import { Booking } from '../models/Booking.js';

const STATUS_TITLES = {
  401: 'Unauthorized',
  404: 'Not Found',
  409: 'Conflict',
  500: 'Internal Server Error'
};

/**
 * Creates the bookings router (injectable service for unit tests).
 */
export function createTicketRouter(deps = {}) {
  const router = Router();
  const build = deps.buildTicket || buildTicket;

  router.get('/mine', requireSession, async (req, res, next) => {
    try {
      const active = await Booking.find({
        ownerId: req.sessionUser.id,
        status: 'CONFIRMED'
      }).select('id slotId').lean();
      return res.json({
        bookings: active.map((b) => ({ bookingId: b.id, slotId: b.slotId }))
      });
    } catch (err) {
      return next(err);
    }
  });

  /**
   * GET /api/bookings/:id/ticket.pdf
   * Streams the official PDF ticket inline (or as attachment with ?download=true).
   */
  router.get('/:id/ticket.pdf', requireSession, async (req, res) => {
    try {
      const download = req.query.download === 'true';
      const result = await build(req.sessionUser.id, req.params.id);
      const dispositionType = download ? 'attachment' : 'inline';

      res.status(200);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `${dispositionType}; filename="${result.filename}"`
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Length', String(result.pdf.length));

      return res.send(result.pdf);
    } catch (err) {
      const status = err.status || 500;
      const title = STATUS_TITLES[status] || 'Error';
      const detail = status >= 500
        ? 'La génération du billet PDF a échoué.'
        : err.message;

      return res
        .status(status)
        .type('application/problem+json')
        .json(buildProblemDetail(status, title, detail));
    }
  });

  return router;
}

export const ticketRouter = createTicketRouter();
