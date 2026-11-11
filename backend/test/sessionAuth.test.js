import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createSessionRouter } from '../src/routes/sessionRoutes.js';
import {
  createAttachSession,
  hashPassword,
  hashResetToken,
  signSessionToken,
  verifyPassword,
  verifySessionToken
} from '../src/services/sessionService.js';

const USER = { id: 'u-1', name: 'Ada', email: 'ada@cineslot.test' };

test('sessionService: password hash round-trip', async () => {
  const a = await hashPassword('motdepasse-12');
  const b = await hashPassword('motdepasse-12');
  assert.notEqual(a, b, 'salt must differ');
  assert.equal(await verifyPassword('motdepasse-12', a), true);
  assert.equal(await verifyPassword('mauvais', a), false);
  assert.equal(await verifyPassword('motdepasse-12', 'garbage'), false);
});

test('sessionService: session token round-trip, tampered and expired', () => {
  const token = signSessionToken(USER);
  assert.deepEqual(verifySessionToken(token), { ...USER, ver: 0 });

  const [payload, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ sub: 'admin', exp: Date.now() + 1e6 })).toString('base64url');
  assert.equal(verifySessionToken(`${forged}.${sig}`), null);
  assert.equal(verifySessionToken(`${payload}.x${sig.slice(1)}`), null);
  assert.equal(verifySessionToken(signSessionToken(USER, -1)), null);
});

// Fake User model, in memory.
function createUserStore() {
  const docs = [];
  const matches = (doc, filter) => Object.entries(filter).every(([k, v]) => {
    if (v === null) return doc[k] == null;
    return v && typeof v === 'object' && '$gt' in v ? doc[k] > v.$gt : doc[k] === v;
  });
  return {
    docs,
    async create(doc) {
      if (docs.some((d) => d.email === doc.email)) throw Object.assign(new Error('dup'), { code: 11000 });
      docs.push({ ...doc });
      return { ...doc };
    },
    async findOne(filter) {
      return docs.find((d) => matches(d, filter)) ?? null;
    },
    async exists(filter) {
      return docs.some((d) => matches(d, filter)) ? { _id: filter._id } : null;
    },
    async findOneAndUpdate(filter, update) {
      const doc = docs.find((d) => matches(d, filter));
      if (!doc) return null;
      const before = { ...doc };
      Object.assign(doc, update.$set);
      for (const [k, n] of Object.entries(update.$inc ?? {})) doc[k] = (doc[k] ?? 0) + n;
      for (const k of Object.keys(update.$unset ?? {})) delete doc[k];
      return before;
    }
  };
}

function createTestApp(users, mails, { loginLimiter = (_req, _res, next) => next() } = {}) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(createAttachSession(users));
  app.use('/api/session', createSessionRouter({
    users,
    sendPasswordResetEmail: async (to, link) => mails.push({ to, link }),
    authLimiter: (_req, _res, next) => next(),
    loginLimiter
  }));
  return app;
}

async function withServer(app, fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/session`;
  const post = (path, body, cookie) => fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body)
  });
  try {
    await fn({ post, get: (cookie) => fetch(base, { headers: cookie ? { Cookie: cookie } : {} }) });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test('sessionRoutes: register, duplicate, login and session', async () => {
  const users = createUserStore();
  await withServer(createTestApp(users, []), async ({ post, get }) => {
    const reg = await post('/register', { email: 'Ada@CineSlot.test', name: 'Ada', password: 'motdepasse-12' });
    assert.equal(reg.status, 201);
    assert.equal(users.docs[0].email, 'ada@cineslot.test');
    assert.notEqual(users.docs[0].passwordHash, 'motdepasse-12');

    assert.equal((await post('/register', { email: 'ada@cineslot.test', name: 'X', password: 'motdepasse-12' })).status, 409);
    assert.equal((await post('/register', { email: 'bad', name: 'X', password: 'motdepasse-12' })).status, 400);
    assert.equal((await post('/register', { email: 'b@c.de', name: 'X', password: 'onze-chars1' })).status, 400, 'min 12 chars');

    assert.equal((await post('/login', { email: 'ada@cineslot.test', password: 'faux-mdp' })).status, 401);
    assert.equal((await post('/login', { email: 'inconnu@cineslot.test', password: 'motdepasse-12' })).status, 401);

    const login = await post('/login', { email: 'ada@cineslot.test', password: 'motdepasse-12' });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const session = await (await get(cookie)).json();
    assert.equal(session.authenticated, true);
    assert.equal(session.user.email, 'ada@cineslot.test');
  });
});

test('sessionRoutes: forgot/reset password flow', async () => {
  const users = createUserStore();
  const mails = [];
  await withServer(createTestApp(users, mails), async ({ post, get }) => {
    const reg = await post('/register', { email: 'ada@cineslot.test', name: 'Ada', password: 'ancien-mdp-12' });
    const oldCookie = reg.headers.get('set-cookie').split(';')[0];
    assert.equal((await (await get(oldCookie)).json()).authenticated, true);

    assert.equal((await post('/forgot-password', { email: 'inconnu@cineslot.test' })).status, 204);
    await flush();
    assert.equal(mails.length, 0, 'no mail for unknown account');

    assert.equal((await post('/forgot-password', { email: 'ada@cineslot.test' })).status, 204);
    await flush();
    assert.equal(mails.length, 1);
    const token = new URL(mails[0].link).searchParams.get('token');
    assert.equal(users.docs[0].resetTokenHash, hashResetToken(token), 'only the hash is stored');

    assert.equal((await post('/reset-password', { token: 'faux', password: 'nouveau-mdp-12' })).status, 400);
    assert.equal((await post('/reset-password', { token, password: 'nouveau-mdp-12' })).status, 204);
    assert.equal((await post('/reset-password', { token, password: 'encore-un-mdp' })).status, 400, 'single use');
    assert.equal((await (await get(oldCookie)).json()).authenticated, false, 'reset revokes old sessions');

    assert.equal((await post('/login', { email: 'ada@cineslot.test', password: 'ancien-mdp-12' })).status, 401);
    assert.equal((await post('/login', { email: 'ada@cineslot.test', password: 'nouveau-mdp-12' })).status, 200);

    await post('/forgot-password', { email: 'ada@cineslot.test' });
    await flush();
    const token2 = new URL(mails[1].link).searchParams.get('token');
    users.docs[0].resetTokenExpires = new Date(Date.now() - 1000);
    assert.equal((await post('/reset-password', { token: token2, password: 'nouveau-mdp-13' })).status, 400, 'expired');
  });
});

test('sessionRoutes: login is rate limited per email, not only per IP', async () => {
  const users = createUserStore();
  // null = the router's real limiter (10 attempts per email per 15 min).
  await withServer(createTestApp(users, [], { loginLimiter: null }), async ({ post }) => {
    for (let i = 0; i < 10; i++) {
      assert.equal((await post('/login', { email: 'ada@cineslot.test', password: 'mauvais-mdp' })).status, 401);
    }
    assert.equal((await post('/login', { email: 'ADA@cineslot.test', password: 'mauvais-mdp' })).status, 429);
    assert.equal((await post('/login', { email: 'bob@cineslot.test', password: 'mauvais-mdp' })).status, 401);
  });
});

test('attachSession: deleted account loses its session', async () => {
  const users = createUserStore();
  await withServer(createTestApp(users, []), async ({ post, get }) => {
    const reg = await post('/register', { email: 'ada@cineslot.test', name: 'Ada', password: 'motdepasse-12' });
    const cookie = reg.headers.get('set-cookie').split(';')[0];
    users.docs.length = 0;
    assert.equal((await (await get(cookie)).json()).authenticated, false);
  });
});

test('cookies: COOKIE_SECURE=false drops Secure and the __Host- prefix for the local http stack only', async () => {
  const { spawnSync } = await import('node:child_process');
  const probe = (env) => {
    const { COOKIE_SECURE: _c, ...rest } = process.env;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e',
      "const s = await import('./src/services/sessionService.js'); console.log(JSON.stringify([s.ADMIN_COOKIE_NAME, s.getAdminCookieOptions().secure, s.getSessionCookieOptions().secure]))"], {
      cwd: new URL('..', import.meta.url), env: { ...rest, SESSION_SECRET: 'x'.repeat(32), NODE_ENV: 'production', ...env }, encoding: 'utf8'
    });
    assert.equal(run.status, 0, run.stderr);
    return JSON.parse(run.stdout.trim());
  };
  assert.deepEqual(probe({}), ['__Host-cineslot_admin', true, true]);
  assert.deepEqual(probe({ COOKIE_SECURE: 'true' }), ['__Host-cineslot_admin', true, true]);
  assert.deepEqual(probe({ COOKIE_SECURE: 'false' }), ['cineslot_admin', false, false]);
});
