import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { DEMO_CINEMAS } from '../src/geo/cinemas.js';
import { boundingBox } from '../src/geo/distance.js';
import { keepInRadius } from '../src/geo/finders.js';
import { byDistance, createCinemaRouter } from '../src/routes/cinemaRoutes.js';

const AROUND_BELLECOUR = '/api/cinemas?lat=45.7576&lon=4.8317&radiusKm=5';

const memoryFinder = async (q) =>
  keepInRadius(DEMO_CINEMAS.filter((c) => !q.feature || c.features.includes(q.feature)), q);

function createApp(finder = memoryFinder) {
  const app = express();
  app.use('/api/cinemas', createCinemaRouter({ finder }));
  return app;
}

async function get(app, path) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    const text = await res.text();
    return { status: res.status, headers: res.headers, text, body: JSON.parse(text) };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('trouve les 6 cinemas autour de Bellecour', async () => {
  const res = await get(createApp(), AROUND_BELLECOUR);

  assert.equal(res.status, 200);
  assert.equal(res.body.total, 6);
  assert.equal(res.body.data[0].slug, 'cine-bellecour');
  assert.equal(res.body.data[0].distanceKm, 0.1);
  const distances = res.body.data.map((c) => c.distanceKm);
  assert.deepEqual(distances, [...distances].sort((a, b) => a - b));
  assert.ok(distances.every((d) => d <= 5));
});

test('écarte les cinémas dans la boîte mais hors du rayon', async () => {
  const res = await get(createApp(), AROUND_BELLECOUR);
  const box = boundingBox(45.7576, 4.8317, 5);
  const corner = DEMO_CINEMAS.find((c) => c.slug === 'cine-croix-luizet');

  assert.ok(corner.latitude <= box.maxLat && corner.longitude <= box.maxLon);
  assert.ok(!res.body.data.some((c) => c.slug === 'cine-croix-luizet'));
});

test('rayon de 5 km par défaut', async () => {
  const res = await get(createApp(), '/api/cinemas?lat=45.7576&lon=4.8317');
  assert.equal(res.body.total, 6);
});

test('filtre imax', async () => {
  const res = await get(createApp(), `${AROUND_BELLECOUR}&feature=imax`);
  assert.deepEqual(res.body.data.map((c) => c.slug), ['cine-confluence', 'cine-part-dieu']);
});

test('pagination sans doublon', async () => {
  const p1 = await get(createApp(), `${AROUND_BELLECOUR}&limit=4&page=1`);
  const p2 = await get(createApp(), `${AROUND_BELLECOUR}&limit=4&page=2`);

  assert.equal(p1.body.data.length, 4);
  assert.equal(p2.body.data.length, 2);
  assert.equal(p2.body.total, 6);
  const slugs = [...p1.body.data, ...p2.body.data].map((c) => c.slug);
  assert.equal(new Set(slugs).size, 6);
});

test('rien autour de 0,0', async () => {
  const res = await get(createApp(), '/api/cinemas?lat=0&lon=0');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 0);
});

test('a distance egale on trie par nom', () => {
  const a = { km: 1, cinema: { name: 'B', slug: 'b' } };
  const b = { km: 1, cinema: { name: 'A', slug: 'z' } };
  const c = { km: 1, cinema: { name: 'A', slug: 'a' } };
  assert.deepEqual([a, b, c].sort(byDistance), [c, b, a]);
});

test('400 si paramètres invalides', async () => {
  const app = createApp();

  const res = await get(app, '/api/cinemas?lat=95&lon=4.8');
  assert.equal(res.status, 400);
  assert.equal(res.headers.get('content-type'), 'application/problem+json; charset=utf-8');
  assert.equal(res.body.detail, 'Latitude invalide : entre -90 et 90 degrés.');

  const resLatSeule = await get(app, '/api/cinemas?lat=45.75');
  assert.equal(resLatSeule.body.detail, 'Indiquez lat et lon ensemble.');

  const resAbc = await get(app, '/api/cinemas?lat=abc&lon=4.8');
  assert.equal(resAbc.status, 400);
  assert.equal(resAbc.body.detail, 'Paramètre invalide : lat.');

  const resRayon = await get(app, '/api/cinemas?lat=45.75&lon=4.8&radiusKm=30');
  assert.equal(resRayon.body.detail, 'Rayon invalide : plus de 0 et au plus 20 km.');

  const resFeature = await get(app, '/api/cinemas?lat=45.75&lon=4.8&feature=4dx');
  assert.equal(resFeature.body.detail, 'Équipement invalide : imax, dolby, vo.');

  const resPage = await get(app, '/api/cinemas?lat=45.75&lon=4.8&page=0');
  assert.equal(resPage.status, 400);
  assert.equal(resPage.body.detail, 'Pagination invalide : page à partir de 1, limit de 1 à 50.');
});

test('ne renvoie pas la position reçue', async () => {
  const res = await get(createApp(), '/api/cinemas?lat=45.75761&lon=4.83172');
  assert.ok(!res.text.includes('45.75761'));
  assert.ok(!res.text.includes('4.83172'));
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('GET /current renvoie le nom et le statut du cinéma du sous-domaine', async (t) => {
  const { Cinema } = await import('../src/models/Cinema.js');
  t.mock.method(Cinema, 'findOne', (filter) => ({
    lean: async () => (filter.slug === 'cine-bellecour'
      ? { slug: 'cine-bellecour', name: 'Ciné Bellecour', address: 'Place Bellecour', city: 'Lyon', features: [], status: 'DISABLED' }
      : null)
  }));
  const app = express();
  app.use((req, _res, next) => { req.tenant = { slug: 'cine-bellecour' }; next(); });
  app.use('/api/cinemas', createCinemaRouter({ finder: memoryFinder }));

  const res = await get(app, '/api/cinemas/current');
  assert.equal(res.status, 200);
  assert.equal(res.body.name, 'Ciné Bellecour');
  assert.equal(res.body.status, 'DISABLED');

  const noTenant = await get(createApp(), '/api/cinemas/current');
  assert.equal(noTenant.status, 404);

  const badSlug = await get(createApp(), '/api/cinemas/ADMIN');
  assert.equal(badSlug.status, 404);
});
