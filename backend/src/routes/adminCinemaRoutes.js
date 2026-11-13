import { Router } from 'express';
import { trace, isSpanContextValid } from '@opentelemetry/api';
import { Cinema } from '../models/Cinema.js';
import { appendAudit, emitReservationEvent } from '../events/index.js';
import { invalidateCinemaStatusCache } from '../services/cinemaStatusService.js';
import { buildProblemDetail, requireRecentMfa, requireRole } from '../services/sessionService.js';
import { broadcastCinemaStatus } from '../services/slotService.js';
import { getTenantModels, isValidSlug, useTenantDb } from '../tenancy/index.js';
import { isPlainString } from '../utils/securityMiddleware.js';

function problem(res, status, title, detail) {
  return res
    .status(status)
    .type('application/problem+json')
    .json(buildProblemDetail(status, title, detail));
}

function getTraceId() {
  const ctx = trace.getActiveSpan()?.spanContext();
  return ctx && isSpanContextValid(ctx) ? ctx.traceId : null;
}

export function createAdminCinemaRouter(deps = {}) {
  const cinemas = deps.cinemas || Cinema;
  const getDb = deps.useTenantDb || useTenantDb;
  const getModels = deps.getTenantModels || getTenantModels;
  const audit = deps.appendAudit || appendAudit;
  const emitEvent = deps.emitReservationEvent || emitReservationEvent;
  const invalidateCache = deps.invalidateCinemaStatusCache || invalidateCinemaStatusCache;
  const broadcastStatus = deps.broadcastCinemaStatus || broadcastCinemaStatus;
  const nowFn = deps.nowFn || (() => new Date());

  const router = Router();

  router.use((req, res, next) => {
    if (req.plane !== 'admin') {
      return problem(res, 404, 'Not Found', 'Route réservée au plan admin.');
    }
    return next();
  });

  router.use(requireRole('SUPER_ADMIN'));
  router.use(requireRecentMfa());

  router.get('/', async (_req, res, next) => {
    try {
      const query = cinemas.find({});
      const sorted = typeof query.sort === 'function' ? query.sort({ slug: 1 }) : query;
      const list = typeof sorted.lean === 'function' ? await sorted.lean() : await sorted;
      return res.json(list);
    } catch (err) {
      return next(err);
    }
  });

  router.post('/', async (req, res, next) => {
    try {
      const slug = typeof req.body?.slug === 'string' ? req.body.slug.trim() : '';
      if (!isValidSlug(slug)) {
        return problem(res, 400, 'Bad Request', 'Slug de cinéma invalide ou réservé.');
      }

      const name = isPlainString(req.body?.name, 120) ? req.body.name.trim() : '';
      const address = isPlainString(req.body?.address, 200) ? req.body.address.trim() : '';
      const city = isPlainString(req.body?.city, 100) ? req.body.city.trim() : '';
      const latitude = Number(req.body?.latitude);
      const longitude = Number(req.body?.longitude);
      const features = Array.isArray(req.body?.features)
        ? req.body.features.filter((f) => typeof f === 'string').map((f) => f.trim().slice(0, 50))
        : [];

      if (!name || !address || !city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return problem(res, 400, 'Bad Request', 'Champs obligatoires manquants ou invalides.');
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return problem(res, 400, 'Bad Request', 'Coordonnées géographiques invalides.');
      }

      const created = await cinemas.create({
        slug,
        name,
        address,
        city,
        latitude,
        longitude,
        location: { type: 'Point', coordinates: [longitude, latitude] },
        features,
        status: 'ACTIVE',
        deletedAt: null,
        purgeState: null
      });

      const db = getDb(slug);
      const { Slot, Booking } = getModels(db);
      await Promise.all([
        typeof Slot.createIndexes === 'function' ? Slot.createIndexes() : Promise.resolve(),
        typeof Booking.createIndexes === 'function' ? Booking.createIndexes() : Promise.resolve()
      ]);

      invalidateCache(slug);
      await audit({
        actor: req.sessionUser.id,
        action: 'CINEMA_CREATE',
        target: slug,
        before: null,
        after: { slug, name, status: 'ACTIVE' },
        result: 'SUCCESS'
      });

      return res.status(201).json(created);
    } catch (err) {
      if (err?.code === 11000) {
        return problem(res, 409, 'Conflict', 'Un cinéma existe déjà avec ce slug.');
      }
      return next(err);
    }
  });

  router.patch('/:slug/status', async (req, res, next) => {
    try {
      const { slug } = req.params;
      if (!isValidSlug(slug)) {
        return problem(res, 400, 'Bad Request', 'Slug de cinéma invalide.');
      }
      const nextStatus = req.body?.status;
      if (nextStatus !== 'ACTIVE' && nextStatus !== 'DISABLED') {
        return problem(res, 400, 'Bad Request', 'Statut invalide (ACTIVE ou DISABLED attendu).');
      }

      const updateFields = { status: nextStatus, deletedAt: null, purgeState: null };

      const before = await cinemas.findOneAndUpdate(
        { slug },
        { $set: updateFields },
        { new: false }
      );
      if (!before) {
        return problem(res, 404, 'Not Found', 'Cinéma introuvable.');
      }

      invalidateCache(slug);
      broadcastStatus(slug, nextStatus);
      await audit({
        actor: req.sessionUser.id,
        action: 'CINEMA_STATUS_UPDATE',
        target: slug,
        before: { status: before.status },
        after: { status: nextStatus },
        result: 'SUCCESS'
      });

      return res.json({
        slug,
        status: nextStatus,
        deletedAt: null,
        purgeState: null
      });
    } catch (err) {
      return next(err);
    }
  });

  router.delete('/:slug', async (req, res, next) => {
    try {
      const { slug } = req.params;
      if (!isValidSlug(slug)) {
        return problem(res, 400, 'Bad Request', 'Slug de cinéma invalide.');
      }

      const now = nowFn();
      const before = await cinemas.findOneAndUpdate(
        { slug },
        { $set: { status: 'DELETED', deletedAt: now, purgeState: 'PENDING' } },
        { new: false }
      );
      if (!before) {
        return problem(res, 404, 'Not Found', 'Cinéma introuvable.');
      }

      const db = getDb(slug);
      const { Slot, Booking } = getModels(db);
      const nowIso = now.toISOString();
      const findQuery = Booking.find({ status: 'CONFIRMED', startsAt: { $gt: nowIso } });
      const futureBookings = typeof findQuery?.lean === 'function' ? await findQuery.lean() : await findQuery;

      const traceId = getTraceId();
      let cancelledBookings = 0;

      for (const booking of futureBookings) {
        const cancelled = await Booking.findOneAndUpdate(
          { _id: booking._id, status: 'CONFIRMED' },
          { $set: { status: 'CANCELLED', cancelledAt: now } }
        );
        if (!cancelled) {
          continue;
        }
        cancelledBookings += 1;
        const qty = booking.totalQuantity ?? 1;
        if (typeof Slot.findOneAndUpdate === 'function') {
          await Slot.findOneAndUpdate(
            { _id: booking.slotId },
            [
              {
                $set: {
                  availableSeats: {
                    $min: [
                      { $add: [{ $ifNull: ['$availableSeats', 0] }, qty] },
                      { $ifNull: ['$capacity', 40] }
                    ]
                  },
                  status: 'AVAILABLE'
                }
              }
            ],
            { new: true }
          );
        }
        await emitEvent({
          action: 'CANCELLED',
          cinemaSlug: slug,
          slotId: booking.slotId,
          movieId: booking.movieId ?? null,
          bookingId: booking._id,
          userId: booking.ownerId,
          quantity: qty,
          reason: 'CINEMA_DELETED',
          traceId
        });
      }

      invalidateCache(slug);
      broadcastStatus(slug, 'DELETED');
      await audit({
        actor: req.sessionUser.id,
        action: 'CINEMA_SOFT_DELETE',
        target: slug,
        before: { status: before.status },
        after: { status: 'DELETED', deletedAt: now, cancelledBookings },
        result: 'SUCCESS'
      });

      return res.json({ slug, status: 'DELETED', cancelledBookings });
    } catch (err) {
      return next(err);
    }
  });

  return router;
}

export const adminCinemaRouter = createAdminCinemaRouter();
