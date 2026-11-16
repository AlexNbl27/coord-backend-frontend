export const GEO_MESSAGES = {
  insecure: 'La localisation exige une page sécurisée (HTTPS). Saisissez une adresse ou un code postal.',
  unsupported: 'Votre navigateur ne sait pas donner votre position. Saisissez une adresse ou un code postal.',
  denied: 'Localisation refusée. Saisissez une adresse ou un code postal.',
  unavailable: 'Position introuvable pour le moment. Saisissez une adresse.',
  timeout: 'La localisation prend trop de temps. Réessayez ou saisissez une adresse.',
  'not-found': 'Adresse introuvable ou trop imprécise. Précisez la ville ou le code postal.',
  busy: "Le service d'adresses est très sollicité. Réessayez dans une seconde.",
  network: "Le service d'adresses ne répond pas. Vérifiez le réseau puis réessayez.",
};

export class GeoError extends Error {
  reason: string;
  constructor(reason: keyof typeof GEO_MESSAGES) {
    super(GEO_MESSAGES[reason]);
    this.reason = reason;
  }
}

export interface Center {
  lat: number;
  lon: number;
  accuracyM?: number;
  label?: string;
}

export function getPosition(): Promise<Center> {
  if (!window.isSecureContext) return Promise.reject(new GeoError('insecure'));
  if (!navigator.geolocation) return Promise.reject(new GeoError('unsupported'));

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({
        lat: roundCoord(p.coords.latitude),
        lon: roundCoord(p.coords.longitude),
        accuracyM: p.coords.accuracy,
      }),
      (e) => {
        if (e.code === 1) reject(new GeoError('denied'));
        else if (e.code === 3) reject(new GeoError('timeout'));
        else reject(new GeoError('unavailable'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}

export function roundCoord(x: number): number {
  return Math.round(x * 1000) / 1000;
}

export function nearbyParams(center: Center, radiusKm: number, feature: string, page: number) {
  const params: Record<string, string> = {
    lat: String(roundCoord(center.lat)),
    lon: String(roundCoord(center.lon)),
    radiusKm: String(radiusKm),
    page: String(page),
    limit: '6',
  };
  if (feature) params.feature = feature;
  return params;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`;
}

interface GeocoderFeature {
  geometry: { coordinates: [number, number] };
  properties: { label: string; score: number };
}

export const geocodeCache = new Map<string, Center>();

export async function geocode(input: string): Promise<Center> {
  const key = input.trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) throw new GeoError('not-found');

  const cached = geocodeCache.get(key);
  if (cached) return cached;

  let res: Response;
  try {
    res = await fetch(`https://data.geopf.fr/geocodage/search?${new URLSearchParams({ q: key, limit: '1' })}`);
  } catch {
    throw new GeoError('network');
  }
  if (res.status === 429) throw new GeoError('busy');
  if (!res.ok) throw new GeoError('network');

  const feature: GeocoderFeature | undefined = (await res.json()).features?.[0];
  if (!feature || feature.properties.score < 0.5) throw new GeoError('not-found');

  const [lon, lat] = feature.geometry.coordinates;
  const center = { lat: roundCoord(lat), lon: roundCoord(lon), label: feature.properties.label };
  geocodeCache.set(key, center);
  return center;
}
