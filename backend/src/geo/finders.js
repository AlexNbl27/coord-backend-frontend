import { Cinema } from '../models/Cinema.js';
import { boundingBox, haversineKm } from './distance.js';

export function keepInRadius(cinemas, { lat, lon, radiusKm }) {
  return cinemas
    .map((cinema) => ({ cinema, km: haversineKm(lat, lon, cinema.latitude, cinema.longitude) }))
    .filter((c) => c.km <= radiusKm);
}

export async function findInBox(query) {
  const box = boundingBox(query.lat, query.lon, query.radiusKm);
  const filter = {
    latitude: { $gte: box.minLat, $lte: box.maxLat },
    longitude: { $gte: box.minLon, $lte: box.maxLon }
  };
  if (query.feature) filter.features = query.feature;
  const rows = await Cinema.find(filter).lean();
  return keepInRadius(rows, query);
}

export async function findWithGeoNear({ lat, lon, radiusKm, feature }) {
  const rows = await Cinema.aggregate([
    {
      $geoNear: {
        near: { type: 'Point', coordinates: [lon, lat] },
        distanceField: 'meters',
        maxDistance: radiusKm * 1000,
        spherical: true,
        query: feature ? { features: feature } : {}
      }
    }
  ]);
  return rows.map((row) => ({ cinema: row, km: row.meters / 1000 }));
}
