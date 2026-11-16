const R = 6371;

export function haversineKm(lat1, lon1, lat2, lon2) {
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const dLat = lat2Rad - lat1Rad;
  const dLon = toRadians(lon2 - lon1);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function roundKm(km) {
  return Math.round(km * 10) / 10;
}

export function boundingBox(lat, lon, radiusKm) {
  const dLat = radiusKm / 111.2;
  const dLon = radiusKm / (111.2 * Math.cos(toRadians(lat)));
  return { minLat: lat - dLat, maxLat: lat + dLat, minLon: lon - dLon, maxLon: lon + dLon };
}

function toRadians(deg) {
  return deg * Math.PI / 180;
}
