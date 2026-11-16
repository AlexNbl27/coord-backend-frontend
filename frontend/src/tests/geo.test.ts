import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import NearbyBar from '@/components/NearbyBar.vue';
import {
  formatDistance,
  GEO_MESSAGES,
  GeoError,
  geocode,
  geocodeCache,
  getPosition,
  nearbyParams,
  roundCoord,
} from '@/services/geo';
import { expectNoA11yViolations } from './setup';

function mockGeolocation(result: any) {
  const getCurrentPosition = vi.fn((ok: any, ko: any, _options: any) => {
    if (result.code) ko({ code: result.code });
    else ok({ coords: { latitude: result.lat, longitude: result.lon, accuracy: result.accuracy ?? 30 } });
  });
  Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

function geocoderResponse(coordinates: [number, number], score = 0.9, label = '69002 Lyon') {
  return new Response(JSON.stringify({
    features: [{ geometry: { type: 'Point', coordinates }, properties: { label, score } }],
  }));
}

beforeEach(() => {
  vi.stubGlobal('isSecureContext', true);
  geocodeCache.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'geolocation', { value: undefined, configurable: true });
});

describe('Position', () => {
  it('renvoie la position arrondie', async () => {
    const getCurrentPosition = mockGeolocation({ lat: 45.757597, lon: 4.831712, accuracy: 1200 });

    await expect(getPosition()).resolves.toEqual({ lat: 45.758, lon: 4.832, accuracyM: 1200 });
    expect(getCurrentPosition.mock.calls[0][2]).toMatchObject({ timeout: 10000 });
  });

  it('refus de l\'utilisateur', async () => {
    mockGeolocation({ code: 1 });
    const err = await getPosition().catch((e) => e);

    expect(err).toBeInstanceOf(GeoError);
    expect(err.reason).toBe('denied');
    expect(err.message).toBe(GEO_MESSAGES.denied);
  });

  it('timeout', async () => {
    mockGeolocation({ code: 3 });
    await expect(getPosition()).rejects.toMatchObject({ reason: 'timeout' });
  });

  it('refuse hors HTTPS', async () => {
    vi.stubGlobal('isSecureContext', false);
    const getCurrentPosition = mockGeolocation({ lat: 45.7576, lon: 4.8317 });

    await expect(getPosition()).rejects.toMatchObject({ reason: 'insecure' });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('navigateur sans géolocalisation', async () => {
    await expect(getPosition()).rejects.toMatchObject({ reason: 'unsupported' });
  });
});

describe('Paramètres', () => {
  it('arrondit à 3 décimales', () => {
    expect(roundCoord(45.757597)).toBe(45.758);
    expect(roundCoord(-0.57499)).toBe(-0.575);
  });

  it('construit les paramètres arrondis', () => {
    expect(nearbyParams({ lat: 45.757597, lon: 4.831712 }, 5, 'imax', 2)).toEqual({
      lat: '45.758',
      lon: '4.832',
      radiusKm: '5',
      feature: 'imax',
      page: '2',
      limit: '6',
    });
  });
});

describe('Affichage', () => {
  it('affiche m ou km', () => {
    expect(formatDistance(0.1)).toBe('100 m');
    expect(formatDistance(0.95)).toBe('950 m');
    expect(formatDistance(2.1)).toBe('2,1 km');
    expect(formatDistance(5)).toBe('5 km');
  });
});

describe('Géocodage', () => {
  it('coordinates est dans l\'ordre lon, lat', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geocoderResponse([4.8357, 45.7637]));

    const center = await geocode('69002');

    expect(center).toEqual({ lat: 45.764, lon: 4.836, label: '69002 Lyon' });
  });

  it('met en cache par adresse normalisée', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => geocoderResponse([4.83, 45.75]));

    await geocode('69002  Lyon');
    await geocode(' 69002 LYON ');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy.mock.calls[0][0]).toBe('https://data.geopf.fr/geocodage/search?q=69002+lyon&limit=1');
  });

  it('refuse un score trop bas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geocoderResponse([4.83, 45.75], 0.3));

    await expect(geocode('xyz')).rejects.toMatchObject({ reason: 'not-found' });
  });

  it('429 puis nouvel essai ok', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(geocoderResponse([4.83, 45.75]));

    await expect(geocode('69002')).rejects.toMatchObject({ reason: 'busy' });
    await expect(geocode('69002')).resolves.toMatchObject({ lat: 45.75 });
  });

  it('erreur réseau', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(geocode('69002')).rejects.toMatchObject({ reason: 'network' });
  });
});

describe('NearbyBar', () => {
  it('affiche l\'erreur si la localisation est refusée', async () => {
    const getCurrentPosition = mockGeolocation({ code: 1 });
    const { container } = render(NearbyBar);

    expect(getCurrentPosition).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Autour de moi (5 km)' }));

    expect((await screen.findByRole('alert')).textContent).toBe(GEO_MESSAGES.denied);
    expect(document.activeElement).toBe(screen.getByLabelText('Adresse ou code postal'));
    await expectNoA11yViolations(container);
  });

  it('émet le centre de l\'adresse', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geocoderResponse([4.83, 45.75]));
    const { emitted } = render(NearbyBar);

    await userEvent.type(screen.getByLabelText('Adresse ou code postal'), '69002');
    await userEvent.click(screen.getByRole('button', { name: 'Chercher autour' }));

    await vi.waitFor(() => expect(emitted().center).toBeTruthy());
    expect(emitted().center[0]).toEqual([{ lat: 45.75, lon: 4.83, label: '69002 Lyon' }]);
  });
});
