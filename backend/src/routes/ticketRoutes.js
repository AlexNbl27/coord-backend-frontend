import { Router } from 'express';
import { Cinema } from '../models/Cinema.js';
import { requireSession, sendProblem } from '../services/sessionService.js';
import { buildTicket } from '../services/ticketService.js';
import { getTenantModels, isValidSlug, useTenantDb } from '../tenancy/index.js';

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
      const { Booking } = getTenantModels(req.tenant?.db);
      const active = await Booking.find({
        ownerId: req.sessionUser.id,
        status: 'CONFIRMED'
      }).select('_id slotId').lean();
      return res.json({
        bookings: active.map((b) => ({ bookingId: b._id, slotId: b.slotId }))
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
      const result = await build(req.sessionUser.id, req.params.id, { tenant: req.tenant });
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

      return sendProblem(res, status, title, detail);
    }
  });

  return router;
}

export const ticketRouter = createTicketRouter();

export function createMyBookingsRouter(deps = {}) {
  const cinemas = deps.cinemas || Cinema;
  const getDb = deps.useTenantDb || useTenantDb;
  const getModels = deps.getTenantModels || getTenantModels;
  const router = Router();

  router.get('/', requireSession, async (req, res, next) => {
    try {
      if (req.plane === 'admin') {
        return res.status(404).end();
      }
      const list = await cinemas.find({ status: { $ne: 'DELETED' } }, 'slug name').lean();
      const all = [];
      for (const cinema of list) {
        if (!isValidSlug(cinema.slug)) {
          continue;
        }
        const { Booking } = getModels(getDb(cinema.slug));
        const rows = await Booking.find({ ownerId: req.sessionUser.id }).sort({ bookedAt: -1 }).lean();
        for (const b of rows) {
          all.push({
            bookingId: b._id,
            slotId: b.slotId,
            cinemaSlug: cinema.slug,
            cinemaName: cinema.name,
            movieTitle: b.movieTitle,
            hall: b.hall,
            address: b.address,
            startsAt: b.startsAt,
            seat: b.seat,
            tickets: b.tickets,
            totalQuantity: b.totalQuantity,
            totalAmount: b.totalAmount,
            status: b.status === 'CONFIRMED' ? 'ACTIVE' : 'CANCELLED',
            bookedAt: b.bookedAt,
            cancelledAt: b.cancelledAt
          });
        }
      }
      all.sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime());
      return res.json({ bookings: all });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export const myBookingsRouter = createMyBookingsRouter();
