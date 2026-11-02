import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import test from 'node:test';
import { promisify } from 'node:util';
import express from 'express';
import cookieParser from 'cookie-parser';
import { User } from '../src/models/User.js';
import { createSessionRouter } from '../src/routes/sessionRoutes.js';
import {
  createAttachSession,
  hashPassword,
  requireRole,
  requireTenantAccess,
  toPublicUser,
  verifyPassword
} from '../src/services/sessionService.js';

const scrypt = promisify(crypto.scrypt);

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
      const stored = { role: 'SPECTATOR', cinemaSlugs: [], ...doc };
      docs.push(stored);
      return { ...stored };
    },
    findOne(filter) {
      const doc = docs.find((d) => matches(d, filter)) ?? null;
      const result = doc ? { ...doc } : null;
      return {
        lean: async () => result,
        then: (resolve, reject) => Promise.resolve(result).then(resolve, reject)
      };
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

function makeMockRes() {
  const res = {
    statusCode: 200,
    contentType: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    type(t) {
      this.contentType = t;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
  return res;
}

test('requireRole returns 401 without session, 403 for wrong role, calls next for allowed role', () => {
  const mw = requireRole('SUPER_ADMIN', 'CINEMA_ADMIN');

  const res401 = makeMockRes();
  let called = false;
  mw({ sessionUser: null }, res401, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res401.statusCode, 401);
  assert.equal(res401.contentType, 'application/problem+json');
  assert.equal(res401.body.status, 401);

  const res403 = makeMockRes();
  mw({ sessionUser: { id: 'u1', role: 'SPECTATOR', cinemaSlugs: [] } }, res403, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res403.statusCode, 403);
  assert.equal(res403.contentType, 'application/problem+json');
  assert.equal(res403.body.status, 403);

  const resOk = makeMockRes();
  mw({ sessionUser: { id: 'u2', role: 'CINEMA_ADMIN', cinemaSlugs: ['lyon'] } }, resOk, () => { called = true; });
  assert.equal(called, true);
});

test('requireTenantAccess checks SUPER_ADMIN and CINEMA_ADMIN cinemaSlugs', () => {
  const res401 = makeMockRes();
  let called = false;
  requireTenantAccess({ sessionUser: null, tenant: { slug: 'lyon' } }, res401, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res401.statusCode, 401);

  called = false;
  requireTenantAccess(
    { sessionUser: { id: 'sa', role: 'SUPER_ADMIN', cinemaSlugs: [] }, tenant: { slug: 'paris' } },
    makeMockRes(),
    () => { called = true; }
  );
  assert.equal(called, true);

  called = false;
  requireTenantAccess(
    { sessionUser: { id: 'ca', role: 'CINEMA_ADMIN', cinemaSlugs: ['lyon', 'nice'] }, tenant: { slug: 'lyon' } },
    makeMockRes(),
    () => { called = true; }
  );
  assert.equal(called, true);

  const resWrongTenant = makeMockRes();
  called = false;
  requireTenantAccess(
    { sessionUser: { id: 'ca', role: 'CINEMA_ADMIN', cinemaSlugs: ['lyon'] }, tenant: { slug: 'paris' } },
    resWrongTenant,
    () => { called = true; }
  );
  assert.equal(called, false);
  assert.equal(resWrongTenant.statusCode, 403);
  assert.equal(resWrongTenant.contentType, 'application/problem+json');

  const resSpectator = makeMockRes();
  called = false;
  requireTenantAccess(
    { sessionUser: { id: 'sp', role: 'SPECTATOR', cinemaSlugs: ['lyon'] }, tenant: { slug: 'lyon' } },
    resSpectator,
    () => { called = true; }
  );
  assert.equal(called, false);
  assert.equal(resSpectator.statusCode, 403);
});

test('logout increments sessionVersion and invalidates existing token', async () => {
  const users = createUserStore();
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(createAttachSession(users));
  app.use('/api/session', createSessionRouter({
    users,
    authLimiter: (_req, _res, next) => next(),
    loginLimiter: (_req, _res, next) => next()
  }));

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/session`;
  try {
    const reg = await fetch(`${base}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ada@cineslot.test', name: 'Ada', password: 'motdepasse-12' })
    });
    assert.equal(reg.status, 201);
    const regBody = await reg.json();
    assert.equal(regBody.user.role, 'SPECTATOR');
    const cookie = reg.headers.get('set-cookie').split(';')[0];

    const beforeLogout = await (await fetch(base, { headers: { Cookie: cookie } })).json();
    assert.equal(beforeLogout.authenticated, true);
    assert.equal(beforeLogout.user.role, 'SPECTATOR');

    const logoutRes = await fetch(`${base}/logout`, {
      method: 'POST',
      headers: { Cookie: cookie }
    });
    assert.equal(logoutRes.status, 204);
    assert.equal(users.docs[0].sessionVersion, 1);

    const afterLogout = await (await fetch(base, { headers: { Cookie: cookie } })).json();
    assert.equal(afterLogout.authenticated, false);
    assert.equal(afterLogout.user, null);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('scrypt N=2**17 hash format and legacy hash compatibility', async () => {
  const newHash = await hashPassword('motdepasse-12');
  assert.match(newHash, /^scrypt\$N=131072,r=8,p=1\$[^$]+\$[^$]+$/);
  assert.equal(await verifyPassword('motdepasse-12', newHash), true);
  assert.equal(await verifyPassword('mauvais-mdp', newHash), false);

  const legacySalt = crypto.randomBytes(16);
  const legacyDerived = await scrypt('ancien-mdp-12', legacySalt, 64);
  const legacyHash = `${legacySalt.toString('base64url')}:${legacyDerived.toString('base64url')}`;
  assert.equal(await verifyPassword('ancien-mdp-12', legacyHash), true);
  assert.equal(await verifyPassword('mauvais-mdp', legacyHash), false);
});

test('toPublicUser exposes role and User schema bumps sessionVersion on role change', async () => {
  assert.deepEqual(
    toPublicUser({ _id: 'u1', name: 'Ada', email: 'ada@cineslot.test', role: 'CINEMA_ADMIN' }),
    { id: 'u1', name: 'Ada', email: 'ada@cineslot.test', role: 'CINEMA_ADMIN' }
  );

  const doc = new User({
    _id: 'u-role-test',
    email: 'role@cineslot.test',
    name: 'Role',
    role: 'SPECTATOR'
  });
  doc.isNew = false;
  doc.role = 'CINEMA_ADMIN';
  for (const fn of User.schema.s.hooks._pres.get('save') ?? []) {
    await new Promise((resolve) => {
      const res = fn.fn.call(doc, resolve);
      if (res && typeof res.then === 'function') res.then(resolve);
      else if (fn.fn.length === 0) resolve();
    });
  }
  assert.equal(doc.sessionVersion, 1);

  const fakeQuery = {
    _update: { $set: { role: 'CINEMA_ADMIN' } },
    getUpdate() { return this._update; }
  };
  for (const fn of User.schema.s.hooks._pres.get('findOneAndUpdate') ?? []) {
    await new Promise((resolve) => {
      const res = fn.fn.call(fakeQuery, resolve);
      if (res && typeof res.then === 'function') res.then(resolve);
      else if (fn.fn.length === 0) resolve();
    });
  }
  assert.equal(fakeQuery._update.$inc.sessionVersion, 1);
});
