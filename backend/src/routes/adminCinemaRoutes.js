import { Router } from 'express';
import { trace, isSpanContextValid } from '@opentelemetry/api';
import { Cinema } from '../models/Cinema.js';
import { appendAudit, emitReservationEvent } from '../events/index.js';
import { invalidateCinemaStatusCache } from '../services/cinemaStatusService.js';
import { requireRecentMfa, requireRole, sendProblem as problem } from '../services/sessionService.js';
import { broadcastCinemaStatus } from '../services/slotService.js';
import { getTenantModels, isValidSlug, useTenantDb } from '../tenancy/index.js';
import { isPlainString } from '../utils/securityMiddleware.js';

function getTraceId() {
  const ctx = trace.getActiveSpan()?.spanContext();
  return ctx && isSpanContextValid(ctx) ? ctx.traceId : null;
}

const EDITABLE_FIELDS = ['name', 'address', 'city', 'latitude', 'longitude', 'features'];

function parseCinemaFields(body) {
  const name = isPlainString(body?.name, 120) ? body.name.trim() : '';
  const address = isPlainString(body?.address, 200) ? body.address.trim() : '';
  const city = isPlainString(body?.city, 100) ? body.city.trim() : '';
  const latitude = Number(body?.latitude);
  const longitude = Number(body?.longitude);
  const features = Array.isArray(body?.features)
    ? body.features.filter((f) => typeof f === 'string').map((f) => f.trim().slice(0, 50)).filter(Boolean)
    : [];

  if (!name || !address || !city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return { error: 'Champs obligatoires manquants ou invalides.' };
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return { error: 'Coordonnées géographiques invalides.' };
  }
  return { name, address, city, latitude, longitude, features };
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

      const parsed = parseCinemaFields(req.body);
      if (parsed.error) {
        return problem(res, 400, 'Bad Request', parsed.error);
      }
      const { name, address, city, latitude, longitude, features } = parsed;

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

  router.patch('/:slug', async (req, res, next) => {
    try {
      const { slug } = req.params;
      if (!isValidSlug(slug)) {
        return problem(res, 400, 'Bad Request', 'Slug de cinéma invalide.');
      }
      if (req.body?.slug !== undefined && req.body.slug !== slug) {
        return problem(res, 400, 'Bad Request', 'Le slug d\'un cinéma ne peut pas être modifié.');
      }
      const parsed = parseCinemaFields(req.body);
      if (parsed.error) {
        return problem(res, 400, 'Bad Request', parsed.error);
      }
      const { name, address, city, latitude, longitude, features } = parsed;

      const before = await cinemas.findOneAndUpdate(
        { slug, status: { $ne: 'DELETED' } },
        {
          $set: {
            name,
            address,
            city,
            latitude,
            longitude,
            location: { type: 'Point', coordinates: [longitude, latitude] },
            features
          }
        },
        { new: false }
      );
      if (!before) {
        return problem(res, 404, 'Not Found', 'Cinéma introuvable ou supprimé.');
      }

      const pick = (doc) => Object.fromEntries(EDITABLE_FIELDS.map((k) => [k, doc[k] ?? null]));
      const after = { name, address, city, latitude, longitude, features };
      await audit({
        actor: req.sessionUser.id,
        action: 'CINEMA_UPDATE',
        target: slug,
        before: pick(before),
        after,
        result: 'SUCCESS'
      });

      return res.json({ slug, status: before.status, ...after });
    } catch (err) {
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
