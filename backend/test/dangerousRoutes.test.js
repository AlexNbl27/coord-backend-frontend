import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import { createSlotRouter } from '../src/routes/slotRoutes.js';
import { createAbRouter } from '../src/routes/abRoutes.js';
import { movieRouter } from '../src/routes/movieRoutes.js';
import { errorHandler } from '../src/utils/errorHandler.js';
import { areDemoRoutesEnabled, sanitizeMoviePayload } from '../src/utils/securityMiddleware.js';

function createTestApp({ demoRoutes = true } = {}) {
  const app = express();
  app.use(express.json({ limit: '1kb' }));
  app.use((req, _res, next) => {
    const role = req.headers['x-test-role'];
    req.sessionUser = role ? { id: 'u-1', name: 'Ada', email: 'ada@cineslot.test', role, cinemaSlugs: [] } : null;
    next();
  });
  app.use('/api/slots', createSlotRouter({ demoRoutes }));
  app.use('/api/ab', createAbRouter({ demoRoutes }));
  app.use('/api/movies', movieRouter);
  app.post('/api/boom/:status', (req, _res, next) => {
    next(Object.assign(new Error('Créneau déjà complet'), { status: Number(req.params.status) }));
  });
  app.use(errorHandler);
  return app;
}

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = (method, path, { role, body, raw } = {}) => fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  try {
    await fn(call);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const GUARDED = [
  ['POST', '/api/slots/reset'],
  ['POST', '/api/slots/lab'],
  ['POST', '/api/ab/simulate'],
  ['GET', '/api/ab/metrics'],
  ['GET', '/api/slots/slot-1/proof'],
  ['POST', '/api/movies'],
  ['PUT', '/api/movies/507f1f77bcf86cd799439011'],
  ['DELETE', '/api/movies/507f1f77bcf86cd799439011']
];

test('dangerous routes: SPECTATOR and CINEMA_ADMIN receive 403 problem+json', async () => {
  await withServer(createTestApp(), async (call) => {
    for (const role of ['SPECTATOR', 'CINEMA_ADMIN']) {
      for (const [method, path] of GUARDED) {
        const res = await call(method, path, { role, body: method === 'GET' ? undefined : { title: 'x' } });
        assert.equal(res.status, 403, `${role} ${method} ${path}`);
        assert.match(res.headers.get('content-type'), /application\/problem\+json/);
        assert.equal((await res.json()).status, 403);
      }
    }
  });
});

test('dangerous routes: anonymous receives 401', async () => {
  await withServer(createTestApp(), async (call) => {
    for (const [method, path] of GUARDED) {
      assert.equal((await call(method, path)).status, 401, `${method} ${path}`);
    }
  });
});

test('dangerous routes: SUPER_ADMIN passes the guard', async () => {
  await withServer(createTestApp(), async (call) => {
    assert.equal((await call('POST', '/api/movies', { role: 'SUPER_ADMIN', body: {} })).status, 400);
    assert.equal((await call('PUT', '/api/movies/not-an-id', { role: 'SUPER_ADMIN', body: {} })).status, 400);
    assert.equal((await call('DELETE', '/api/movies/not-an-id', { role: 'SUPER_ADMIN' })).status, 400);
    assert.equal((await call('GET', '/api/slots/bad%20id!/proof', { role: 'SUPER_ADMIN' })).status, 400);
  });
});

test('demo routes are not mounted when disabled', async () => {
  await withServer(createTestApp({ demoRoutes: false }), async (call) => {
    for (const path of ['/api/slots/reset', '/api/slots/lab', '/api/ab/simulate']) {
      assert.equal((await call('POST', path, { role: 'SUPER_ADMIN', body: {} })).status, 404, path);
    }
    assert.equal((await call('GET', '/api/ab/metrics', { role: 'SPECTATOR' })).status, 403);
  });
});

test('areDemoRoutesEnabled: off in production unless ENABLE_DEMO_ROUTES=true', () => {
  assert.equal(areDemoRoutesEnabled({ NODE_ENV: 'development' }), true);
  assert.equal(areDemoRoutesEnabled({}), true);
  assert.equal(areDemoRoutesEnabled({ NODE_ENV: 'production' }), false);
  assert.equal(areDemoRoutesEnabled({ NODE_ENV: 'production', ENABLE_DEMO_ROUTES: 'false' }), false);
  assert.equal(areDemoRoutesEnabled({ NODE_ENV: 'production', ENABLE_DEMO_ROUTES: '1' }), false);
  assert.equal(areDemoRoutesEnabled({ NODE_ENV: 'production', ENABLE_DEMO_ROUTES: 'true' }), true);
});

test('errorHandler: parser errors get a generic message, app errors keep theirs', async () => {
  await withServer(createTestApp(), async (call) => {
    const malformed = await call('POST', '/api/movies', { role: 'SUPER_ADMIN', raw: '{"title": ' });
    assert.equal(malformed.status, 400);
    assert.match(malformed.headers.get('content-type'), /application\/problem\+json/);
    const body = await malformed.json();
    assert.equal(body.detail, 'La requête n\'a pas pu être traitée.');
    assert.equal(body.title, 'Bad Request');
    assert.doesNotMatch(JSON.stringify(body), /JSON|Unexpected|position/i);

    const tooLarge = await call('POST', '/api/movies', { role: 'SUPER_ADMIN', raw: JSON.stringify({ synopsis: 'x'.repeat(4096) }) });
    assert.equal(tooLarge.status, 413);
    assert.equal((await tooLarge.json()).detail, 'La requête n\'a pas pu être traitée.');

    const conflict = await call('POST', '/api/boom/409');
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).detail, 'Créneau déjà complet');

    const crash = await call('POST', '/api/boom/500');
    assert.equal(crash.status, 500);
    assert.equal((await crash.json()).detail, 'Le service est momentanément indisponible.');
  });
});

test('sanitizeMoviePayload stays an allow-list', () => {
  const payload = sanitizeMoviePayload(JSON.parse(JSON.stringify({
    title: 'Dune',
    director: 'Villeneuve',
    year: 2024,
    _id: 'forged',
    $where: 'sleep(1000)',
    role: 'SUPER_ADMIN',
    ratings: { imdb: 8.5, $gt: '' },
    poster: 'javascript:alert(1)',
    genres: ['SF', { $ne: null }]
  })));
  assert.deepEqual(Object.keys(payload).sort(), ['director', 'genres', 'ratings', 'title', 'year']);
  assert.deepEqual(payload.ratings, { imdb: 8.5 });
  assert.deepEqual(payload.genres, ['SF']);
  assert.equal(sanitizeMoviePayload(JSON.parse('{"__proto__": {"admin": true}}')).admin, undefined);
  assert.equal(sanitizeMoviePayload([]), null);
});
