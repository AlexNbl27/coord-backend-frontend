import { Router } from 'express';
import { Cinema } from '../models/Cinema.js';
import { roundKm } from '../geo/distance.js';
import { findInBox, findWithGeoNear } from '../geo/finders.js';
import { buildProblemDetail } from '../services/sessionService.js';

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function readNumber(query, name) {
  if (query[name] === undefined) return undefined;
  const value = Number.parseFloat(String(query[name]));
  if (Number.isNaN(value)) {
    throw badRequest(`Paramètre invalide : ${name}.`);
  }
  return value;
}

function parseCinemaQuery(query) {
  const lat = readNumber(query, 'lat');
  const lon = readNumber(query, 'lon');
  const radiusKm = readNumber(query, 'radiusKm') ?? 5;
  const page = query.page === undefined ? 1 : parseInt(query.page, 10);
  const limit = query.limit === undefined ? 6 : parseInt(query.limit, 10);
  const feature = query.feature;

  const around = query.lat !== undefined || query.lon !== undefined || query.radiusKm !== undefined;
  if (around) {
    if (lat === undefined || lon === undefined) throw badRequest('Indiquez lat et lon ensemble.');
    if (lat < -90 || lat > 90) throw badRequest('Latitude invalide : entre -90 et 90 degrés.');
    if (lon < -180 || lon > 180) throw badRequest('Longitude invalide : entre -180 et 180 degrés.');
  }
  if (radiusKm <= 0 || radiusKm > 20) {
    throw badRequest('Rayon invalide : plus de 0 et au plus 20 km.');
  }
  if (feature !== undefined && !['imax', 'dolby', 'vo'].includes(feature)) {
    throw badRequest('Équipement invalide : imax, dolby, vo.');
  }
  if (Number.isNaN(page) || Number.isNaN(limit) || page < 1 || limit < 1 || limit > 50) {
    throw badRequest('Pagination invalide : page à partir de 1, limit de 1 à 50.');
  }

  return { lat: lat ?? null, lon: lon ?? null, radiusKm, feature: feature ?? null, page, limit };
}

export function byDistance(a, b) {
  if (a.km !== b.km) return a.km - b.km;
  if (a.cinema.name !== b.cinema.name) return a.cinema.name.localeCompare(b.cinema.name);
  return a.cinema.slug.localeCompare(b.cinema.slug);
}

function toItem(cinema, distanceKm) {
  return {
    slug: cinema.slug,
    name: cinema.name,
    address: cinema.address,
    city: cinema.city,
    features: cinema.features,
    status: cinema.status ?? 'ACTIVE',
    latitude: cinema.latitude,
    longitude: cinema.longitude,
    distanceKm
  };
}

async function listCinemas({ feature, page, limit }) {
  const filter = feature ? { features: feature, status: { $ne: 'DELETED' } } : { status: { $ne: 'DELETED' } };
  const [total, rows] = await Promise.all([
    Cinema.countDocuments(filter),
    Cinema.find(filter).sort({ name: 1, slug: 1 }).skip((page - 1) * limit).limit(limit).lean()
  ]);
  return { page, limit, total, data: rows.map((c) => toItem(c, null)) };
}

async function searchNearby(query, finder) {
  const found = (await finder(query)).sort(byDistance);
  const start = (query.page - 1) * query.limit;
  return {
    page: query.page,
    limit: query.limit,
    total: found.length,
    data: found.slice(start, start + query.limit).map(({ cinema, km }) => toItem(cinema, roundKm(km)))
  };
}

export function createCinemaRouter(deps = {}) {
  const router = Router();
  const finder = deps.finder || (process.env.GEO_FINDER === 'geonear' ? findWithGeoNear : findInBox);

  router.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const query = parseCinemaQuery(req.query);
      const body = query.lat === null ? await listCinemas(query) : await searchNearby(query, finder);
      return res.json(body);
    } catch (err) {
      const status = err.status || 500;
      const detail = status >= 500 ? 'La recherche de cinémas a échoué.' : err.message;
      return res
        .status(status)
        .type('application/problem+json')
        .json(buildProblemDetail(status, status === 400 ? 'Bad Request' : 'Internal Server Error', detail));
    }
  });

  return router;
}

export const cinemaRouter = createCinemaRouter();
