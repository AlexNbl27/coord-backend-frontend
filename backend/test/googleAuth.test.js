import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createGoogleAuthRouter } from '../src/routes/googleAuthRoutes.js';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../src/services/sessionService.js';

const ENV = {
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
  APP_URL: 'http://app.test'
};

function createUserStore(initial = []) {
  const docs = [...initial];
  return {
    docs,
    async findOne(filter) {
      return docs.find((d) => Object.entries(filter).every(([k, v]) => d[k] === v)) ?? null;
    },
    async create(doc) {
      docs.push({ ...doc });
      return { ...doc };
    }
  };
}

// Fake Google: /token then /userinfo
function fakeGoogle(profile, calls = []) {
  return async (url, init) => {
    calls.push({ url, init });
    if (url.includes('/token')) {
      return new Response(JSON.stringify({ access_token: 'at-123' }), { status: 200 });
    }
    return new Response(JSON.stringify(profile), { status: 200 });
  };
}

async function withApp(deps, fn) {
  const app = express();
  app.use(cookieParser());
  app.use('/api/session/google', createGoogleAuthRouter({ env: ENV, limiter: (_q, _r, n) => n(), ...deps }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/session/google`;
  try {
    await fn((path, cookie) => fetch(`${base}${path}`, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} }));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function cookieValue(res, name) {
  const header = res.headers.getSetCookie().find((c) => c.startsWith(`${name}=`));
  return header ? header.split(';')[0] : null;
}

async function start(get, redirect = '/reservations') {
  const res = await get(`/?redirect=${encodeURIComponent(redirect)}`);
  assert.equal(res.status, 302);
  const location = new URL(res.headers.get('location'));
  return { location, stateCookie: cookieValue(res, 'cineslot_oauth') };
}

test('googleAuth: 404 when not configured', async () => {
  await withApp({ env: {} }, async (get) => {
    assert.equal((await get('/')).status, 404);
  });
});

test('googleAuth: start redirects to Google with state and PKCE', async () => {
  await withApp({ users: createUserStore() }, async (get) => {
    const { location, stateCookie } = await start(get);
    assert.equal(location.origin, 'https://accounts.google.com');
    assert.equal(location.searchParams.get('client_id'), 'client-id');
    assert.equal(location.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(location.searchParams.get('redirect_uri'), 'http://app.test/api/session/google/callback');
    assert.ok(location.searchParams.get('state'));
    assert.ok(stateCookie);
  });
});

test('googleAuth: rejects a callback whose state does not match', async () => {
  await withApp({ users: createUserStore(), fetch: fakeGoogle({}) }, async (get) => {
    const { stateCookie } = await start(get);
    const res = await get('/callback?code=abc&state=forged', stateCookie);
    assert.equal(res.headers.get('location'), 'http://app.test/login?error=google');
    assert.equal(cookieValue(res, SESSION_COOKIE_NAME), null);
  });
});

test('googleAuth: creates the user, opens the session and returns to the page', async () => {
  const users = createUserStore();
  const calls = [];
  const profile = { sub: 'g-42', email: 'Ada@Gmail.com', email_verified: true, name: 'Ada' };
  await withApp({ users, fetch: fakeGoogle(profile, calls) }, async (get) => {
    const { location, stateCookie } = await start(get);
    const res = await get(`/callback?code=abc&state=${location.searchParams.get('state')}`, stateCookie);

    assert.equal(res.headers.get('location'), 'http://app.test/reservations');
    const session = cookieValue(res, SESSION_COOKIE_NAME).split('=')[1];
    assert.equal(verifySessionToken(session).email, 'ada@gmail.com');
    assert.equal(users.docs.length, 1);
    assert.equal(users.docs[0].googleId, 'g-42');
    assert.ok(new URLSearchParams(calls[0].init.body).get('code_verifier'), 'PKCE verifier sent');

    // Second sign-in reuses the same account
    const again = await start(get);
    await get(`/callback?code=def&state=${again.location.searchParams.get('state')}`, again.stateCookie);
    assert.equal(users.docs.length, 1);
  });
});

test('googleAuth: refuses unverified emails and existing password accounts', async () => {
  const unverified = { sub: 'g-1', email: 'x@gmail.com', email_verified: false, name: 'X' };
  await withApp({ users: createUserStore(), fetch: fakeGoogle(unverified) }, async (get) => {
    const { location, stateCookie } = await start(get);
    const res = await get(`/callback?code=abc&state=${location.searchParams.get('state')}`, stateCookie);
    assert.equal(res.headers.get('location'), 'http://app.test/login?error=google');
  });

  const users = createUserStore([{ _id: 'u-1', email: 'ada@gmail.com', name: 'Ada', passwordHash: 'h' }]);
  const profile = { sub: 'g-2', email: 'ada@gmail.com', email_verified: true, name: 'Ada' };
  await withApp({ users, fetch: fakeGoogle(profile) }, async (get) => {
    const { location, stateCookie } = await start(get);
    const res = await get(`/callback?code=abc&state=${location.searchParams.get('state')}`, stateCookie);
    assert.equal(res.headers.get('location'), 'http://app.test/login?error=google_email_taken');
    assert.equal(users.docs.length, 1);
  });
});

test('googleAuth: ignores external redirect targets', async () => {
  const profile = { sub: 'g-3', email: 'b@gmail.com', email_verified: true, name: 'B' };
  await withApp({ users: createUserStore(), fetch: fakeGoogle(profile) }, async (get) => {
    const { location, stateCookie } = await start(get, '//evil.example');
    const res = await get(`/callback?code=abc&state=${location.searchParams.get('state')}`, stateCookie);
    assert.equal(res.headers.get('location'), 'http://app.test/');
  });
});

test('googleAuth relay: OAuth on the localhost redirect host, session handed over once to the app host', async () => {
  const users = createUserStore();
  users.updateOne = async (filter, update) => {
    const doc = users.docs.find((d) => d._id === filter._id);
    Object.assign(doc, update.$set);
  };
  users.findOneAndUpdate = async (filter, update) => {
    const doc = users.docs.find((d) => Object.entries(filter).every(([k, v]) => d[k] === v));
    if (!doc) return null;
    const before = { ...doc };
    for (const key of Object.keys(update.$unset)) delete doc[key];
    return before;
  };
  const profile = { sub: 'g-9', email: 'relay@gmail.com', email_verified: true, name: 'Relay' };

  const app = express();
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (req.headers['x-tenant']) req.tenant = { slug: req.headers['x-tenant'] };
    next();
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const env = { ...ENV, GOOGLE_REDIRECT_URI: `http://127.0.0.1:${port}/api/session/google/callback` };
  app.use('/api/session/google', createGoogleAuthRouter({ env, users, fetch: fakeGoogle(profile), limiter: (_q, _r, n) => n() }));
  const get = (url, headers = {}) => fetch(url, { redirect: 'manual', headers });

  try {
    // App host (not the OAuth host): bounce to the OAuth host first
    const bounce = await get(`http://localhost:${port}/api/session/google?redirect=%2Freservations`);
    assert.equal(bounce.headers.get('location'), `http://127.0.0.1:${port}/api/session/google?redirect=%2Freservations`);

    const startRes = await get(bounce.headers.get('location'));
    const stateHeader = startRes.headers.getSetCookie().find((c) => c.startsWith('cineslot_oauth='));
    assert.doesNotMatch(stateHeader, /Domain=/i, 'state cookie is host-only on the relay host');
    const state = new URL(startRes.headers.get('location')).searchParams.get('state');

    const cb = await get(`http://127.0.0.1:${port}/api/session/google/callback?code=abc&state=${state}`, { Cookie: stateHeader.split(';')[0] });
    assert.equal(cookieValue(cb, SESSION_COOKIE_NAME), null, 'no session cookie on the relay host');
    const handoff = new URL(cb.headers.get('location'));
    assert.equal(`${handoff.origin}${handoff.pathname}`, 'http://app.test/api/session/google/complete');
    const token = handoff.searchParams.get('token');
    const complete = (t, headers) => get(`http://127.0.0.1:${port}/api/session/google/complete?token=${encodeURIComponent(t)}`, headers);

    const forged = await complete(`${token.slice(0, -2)}xx`);
    assert.equal(forged.headers.get('location'), 'http://app.test/login?error=google');
    const otherCinema = await complete(token, { 'x-tenant': 'other-cinema' });
    assert.equal(otherCinema.headers.get('location'), 'http://app.test/login?error=google');

    const ok = await complete(token);
    assert.equal(ok.headers.get('location'), '/reservations');
    assert.equal(verifySessionToken(cookieValue(ok, SESSION_COOKIE_NAME).split('=')[1]).email, 'relay@gmail.com');

    const replay = await complete(token);
    assert.equal(replay.headers.get('location'), 'http://app.test/login?error=google');
    assert.equal(cookieValue(replay, SESSION_COOKIE_NAME), null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
