import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import {
  RESERVED_SLUGS,
  createResolveTenant,
  getTenantModels,
  isValidSlug,
  parseHost,
  tenantDbName,
  useTenantDb
} from '../src/tenancy/index.js';
import {
  SESSION_COOKIE_NAME,
  createAttachSession,
  requireTenantAccess,
  signSessionToken
} from '../src/services/sessionService.js';
import { Cinema } from '../src/models/Cinema.js';
import { allSlots, cancelSlot, reserveSlot } from '../src/services/slotService.js';
import { buildTicket } from '../src/services/ticketService.js';
import { createTicketView } from '../src/utils/ticketFormatters.js';

const REGISTRY = new Map([
  ['cine-a', 'ACTIVE'],
  ['cine-b', 'ACTIVE'],
  ['cine-off', 'DISABLED'],
  ['cine-gone', 'DELETED']
]);

const USERS = new Map([
  ['admin-a', { role: 'CINEMA_ADMIN', cinemaSlugs: ['cine-a'], sessionVersion: 0 }],
  ['root', { role: 'SUPER_ADMIN', cinemaSlugs: [], sessionVersion: 0 }],
  ['spectator', { role: 'SPECTATOR', cinemaSlugs: [], sessionVersion: 0 }]
]);

const usersStub = {
  findOne(filter) {
    const doc = USERS.get(filter._id) ?? null;
    return { lean: async () => doc };
  }
};

function cookieFor(id) {
  return `${SESSION_COOKIE_NAME}=${signSessionToken({ _id: id, name: id, email: `${id}@test.local` })}`;
}

function request(port, { path = '/', host, headers = {} }) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'GET', headers: { ...headers, host } },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let body = null;
          try { body = JSON.parse(raw); } catch { body = raw; }
          resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '', body });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function startApp(t) {
  const lookups = [];
  const app = express();
  app.set('trust proxy', 1);
  app.use(cookieParser());
  app.use(createResolveTenant({
    baseDomain: 'cineslot.localhost',
    getStatus: async (slug) => {
      lookups.push(slug);
      return REGISTRY.get(slug) ?? null;
    },
    getDb: (slug) => ({ name: tenantDbName(slug) })
  }));
  app.use(createAttachSession(usersStub));
  app.get('/api/whoami', (req, res) => {
    res.json({
      plane: req.plane,
      slug: req.tenant?.slug ?? null,
      status: req.tenant?.status ?? null,
      dbName: req.tenant?.db?.name ?? null,
      hostname: req.hostname
    });
  });
  app.get('/api/manage', requireTenantAccess, (req, res) => {
    res.json({ slug: req.tenant.slug });
  });
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { port: server.address().port, lookups };
}

test('isValidSlug rejette les slugs mal formés', () => {
  const invalid = [
    undefined, null, 42, {}, '', 'a', 'ab', '-abc', 'abc-', 'a--b', 'Abc', 'ABC', '1abc',
    'a_b', 'a.b', 'a b', 'abc\n', ' abc', 'cine_bellecour', 'é-cine', '../admin', 'cinema_x',
    `a${'b'.repeat(30)}`
  ];
  for (const slug of invalid) {
    assert.equal(isValidSlug(slug), false, `${JSON.stringify(slug)} devrait être refusé`);
  }
});

test('isValidSlug rejette tous les slugs réservés', () => {
  const expected = ['admin', 'api', 'www', 'master', 'cineslot', 'config', 'local', 'static', 'assets', 'otlp', 'mail', 'auth', 'login', 'root', 'test'];
  assert.deepEqual([...RESERVED_SLUGS].sort(), [...expected].sort());
  for (const slug of expected) {
    assert.equal(isValidSlug(slug), false, `${slug} est réservé`);
  }
});

test('isValidSlug accepte les slugs conformes', () => {
  for (const slug of ['abc', 'cine-bellecour', 'a1b', 'cine-2-salles', `a${'b'.repeat(28)}c`]) {
    assert.equal(isValidSlug(slug), true, `${slug} devrait être accepté`);
  }
});

test('tenantDbName préfixe toujours cinema_', () => {
  assert.equal(tenantDbName('cine-bellecour'), 'cinema_cine-bellecour');
  assert.equal(tenantDbName('abc'), 'cinema_abc');
});

test('tenantDbName ne renvoie jamais admin, config, local ni cineslot_master', () => {
  const forbidden = new Set(['admin', 'config', 'local', 'cineslot_master']);
  const attempts = ['admin', 'config', 'local', 'cineslot_master', 'cineslot', 'master', '', null, undefined, '../admin', 'Admin', 'a--b', 'cinema_admin'];
  for (const input of attempts) {
    let result;
    try {
      result = tenantDbName(input);
    } catch (err) {
      assert.ok(err instanceof TypeError);
      continue;
    }
    assert.ok(!forbidden.has(result), `${JSON.stringify(input)} a produit ${result}`);
    assert.ok(result.startsWith('cinema_'));
  }
  assert.throws(() => tenantDbName('admin'), TypeError);
  assert.throws(() => tenantDbName('config'), TypeError);
  assert.throws(() => tenantDbName('cineslot_master'), TypeError);
});

test('useTenantDb passe par tenantDbName et refuse un slug invalide', () => {
  const calls = [];
  const conn = { useDb: (name, opts) => { calls.push([name, opts]); return { name }; } };
  assert.deepEqual(useTenantDb('cine-a', conn), { name: 'cinema_cine-a' });
  assert.deepEqual(calls, [['cinema_cine-a', { useCache: true }]]);
  assert.throws(() => useTenantDb('admin', conn), TypeError);
  assert.equal(calls.length, 1);
});

test('getTenantModels exige une connexion tenant', () => {
  assert.throws(() => getTenantModels(undefined), TypeError);
  assert.throws(() => getTenantModels(null), TypeError);
  assert.throws(() => getTenantModels({}), TypeError);
});

test('parseHost normalise la casse et le port, refuse les hôtes étrangers', () => {
  assert.deepEqual(parseHost('Cine-A.CineSlot.Localhost:3001'), { label: 'cine-a' });
  assert.deepEqual(parseHost('admin.cineslot.localhost'), { label: 'admin' });
  assert.deepEqual(parseHost('cineslot.localhost:3001'), { label: null });
  for (const host of [undefined, '', 'localhost', 'evil.com', 'cine-a.cineslot.localhost.evil.com', 'x.cine-a.cineslot.localhost', 'cine-a.cineslot.localhost:abc', 'cine-a.cineslotXlocalhost']) {
    assert.equal(parseHost(host), null, `${host} devrait être refusé`);
  }
});

test('resolveTenant : sous-domaine actif ou désactivé alimente req.tenant', async (t) => {
  const { port } = await startApp(t);
  const active = await request(port, { path: '/api/whoami', host: 'cine-a.cineslot.localhost:3001' });
  assert.equal(active.status, 200);
  assert.deepEqual(
    { plane: active.body.plane, slug: active.body.slug, status: active.body.status, dbName: active.body.dbName },
    { plane: 'tenant', slug: 'cine-a', status: 'ACTIVE', dbName: 'cinema_cine-a' }
  );
  const disabled = await request(port, { path: '/api/whoami', host: 'cine-off.cineslot.localhost' });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.status, 'DISABLED');
});

test('resolveTenant : 404 inconnu ou invalide, 410 supprimé, 421 hôte étranger', async (t) => {
  const { port, lookups } = await startApp(t);
  const unknown = await request(port, { path: '/api/whoami', host: 'cine-zzz.cineslot.localhost' });
  assert.equal(unknown.status, 404);
  assert.match(unknown.type, /application\/problem\+json/);

  const invalid = await request(port, { path: '/api/whoami', host: 'a--b.cineslot.localhost' });
  assert.equal(invalid.status, 404);

  const reserved = await request(port, { path: '/api/whoami', host: 'config.cineslot.localhost' });
  assert.equal(reserved.status, 404);

  const gone = await request(port, { path: '/api/whoami', host: 'cine-gone.cineslot.localhost' });
  assert.equal(gone.status, 410);
  assert.equal(gone.body.status, 410);

  const foreign = await request(port, { path: '/api/whoami', host: 'evil.com' });
  assert.equal(foreign.status, 421);

  assert.ok(!lookups.includes('a--b'));
  assert.ok(!lookups.includes('config'));
});

test('resolveTenant : admin et apex ne résolvent aucun tenant', async (t) => {
  const { port, lookups } = await startApp(t);
  const admin = await request(port, { path: '/api/whoami', host: 'admin.cineslot.localhost:3001' });
  assert.equal(admin.status, 200);
  assert.equal(admin.body.plane, 'admin');
  assert.equal(admin.body.slug, null);

  const apex = await request(port, { path: '/api/whoami', host: 'cineslot.localhost:3001' });
  assert.equal(apex.status, 200);
  assert.equal(apex.body.plane, 'public');
  assert.equal(apex.body.slug, null);
  assert.deepEqual(lookups, []);
});

test('session admin du tenant A envoyée avec Host b.cineslot.localhost : 403', async (t) => {
  const { port } = await startApp(t);
  const cookie = cookieFor('admin-a');
  const own = await request(port, { path: '/api/manage', host: 'cine-a.cineslot.localhost', headers: { cookie } });
  assert.equal(own.status, 200);
  assert.equal(own.body.slug, 'cine-a');

  const other = await request(port, { path: '/api/manage', host: 'cine-b.cineslot.localhost', headers: { cookie } });
  assert.ok(other.status === 403 || other.status === 404, `statut ${other.status}`);
  assert.match(other.type, /application\/problem\+json/);

  const spectator = await request(port, { path: '/api/manage', host: 'cine-a.cineslot.localhost', headers: { cookie: cookieFor('spectator') } });
  assert.equal(spectator.status, 403);

  const root = await request(port, { path: '/api/manage', host: 'cine-b.cineslot.localhost', headers: { cookie: cookieFor('root') } });
  assert.equal(root.status, 200);
});

test('X-Forwarded-Host falsifié est ignoré', async (t) => {
  const { port } = await startApp(t);
  const cookie = cookieFor('admin-a');

  const toOwnTenant = await request(port, {
    path: '/api/manage',
    host: 'cine-b.cineslot.localhost',
    headers: { cookie, 'x-forwarded-host': 'cine-a.cineslot.localhost' }
  });
  assert.equal(toOwnTenant.status, 403);

  const toAdmin = await request(port, {
    path: '/api/whoami',
    host: 'cine-a.cineslot.localhost',
    headers: { 'x-forwarded-host': 'admin.cineslot.localhost' }
  });
  assert.equal(toAdmin.status, 200);
  assert.equal(toAdmin.body.plane, 'tenant');
  assert.equal(toAdmin.body.slug, 'cine-a');
  assert.equal(toAdmin.body.hostname, 'admin.cineslot.localhost');

  const fromForeign = await request(port, {
    path: '/api/whoami',
    host: 'evil.com',
    headers: { 'x-forwarded-host': 'cine-a.cineslot.localhost' }
  });
  assert.equal(fromForeign.status, 421);
});

function cinemaDoc(slug) {
  return new Cinema({
    slug,
    name: 'Ciné Test',
    address: '1 place Test',
    city: 'Lyon',
    latitude: 45.75,
    longitude: 4.83,
    location: { type: 'Point', coordinates: [4.83, 45.75] }
  });
}

test('Cinema : slug validé par le registre et dbName dérivé', async () => {
  const ok = cinemaDoc('cine-bellecour');
  await ok.validate();
  assert.equal(ok.dbName, 'cinema_cine-bellecour');
  assert.equal(ok.status, 'ACTIVE');

  for (const slug of ['admin', 'config', 'a--b', 'Cine', 'ab', 'cine_bellecour']) {
    await assert.rejects(() => cinemaDoc(slug).validate(), /slug|Slug/, `${slug} devrait être refusé`);
  }
});

test('services slots et billets refusent de travailler sans tenant', async () => {
  await assert.rejects(() => allSlots(null), TypeError);
  await assert.rejects(() => allSlots({ slug: 'cine-a' }), TypeError);
  await assert.rejects(() => cancelSlot('slot-1', null, null), TypeError);
  await assert.rejects(() => buildTicket('u1', 'b1', {}), TypeError);
});

test('reserveSlot : adresse issue du registre et movieId recopié sur la réservation', async () => {
  const movieId = '64b000000000000000000001';
  const created = [];
  const winner = {
    _id: 'slot-1',
    movieId,
    movieTitle: 'Interstellar',
    hall: 'Salle 1',
    startsAt: '2030-01-01T20:00:00.000Z',
    status: 'AVAILABLE',
    version: 1,
    capacity: 40,
    availableSeats: 39
  };
  const statusCalls = [];
  const result = await reserveSlot(
    'slot-1',
    null,
    null,
    false,
    { id: 'u1', name: 'Ada' },
    null,
    { slug: 'cine-a', status: 'ACTIVE' },
    {
      getCinemaStatus: async (slug) => { statusCalls.push(slug); return 'ACTIVE'; },
      getCinemaAddress: async (slug) => (slug === 'cine-a' ? '1 place Test, Lyon' : ''),
      Slot: { findOneAndUpdate: async () => winner },
      Booking: {
        findOne: () => ({ lean: async () => null }),
        create: async (doc) => { created.push(doc); return doc; }
      }
    }
  );
  assert.deepEqual(statusCalls, ['cine-a']);
  assert.equal(created.length, 1);
  assert.equal(created[0].address, '1 place Test, Lyon');
  assert.equal(created[0].movieId, movieId);
  assert.equal(result.movieId, movieId);
});

test('reserveSlot : 423 sur un cinéma désactivé avant tout accès aux données', async () => {
  await assert.rejects(
    () => reserveSlot('slot-1', null, null, false, { id: 'u1', name: 'Ada' }, null, { slug: 'cine-off' }, {
      getCinemaStatus: async () => 'DISABLED'
    }),
    (err) => err.status === 423
  );
});

test('createTicketView ne retombe plus sur une adresse codée en dur', () => {
  const view = createTicketView({ _id: 'b1', slotId: 's1', startsAt: '2030-01-01T20:00:00.000Z' });
  assert.equal(view.address, '');
});

test('migration legacy : refuse une base tenant ou source incohérente', async () => {
  const { migrateLegacyDatabase } = await import('../src/tenancy/legacyMigration.js');
  const db = (databaseName) => ({ databaseName, collection: () => { throw new Error('ne doit pas être lu'); } });
  await assert.rejects(
    () => migrateLegacyDatabase({ sourceDb: db('cours_db'), masterDb: db('cineslot_master'), tenantDb: db('cineslot_master'), slug: 'cine-bellecour' }),
    /Base tenant inattendue/
  );
  await assert.rejects(
    () => migrateLegacyDatabase({ sourceDb: db('cineslot_master'), masterDb: db('cineslot_master'), tenantDb: db('cinema_cine-bellecour'), slug: 'cine-bellecour' }),
    /distincte/
  );
  await assert.rejects(
    () => migrateLegacyDatabase({ sourceDb: db('cours_db'), masterDb: db('cineslot_master'), tenantDb: db('cinema_admin'), slug: 'admin' }),
    TypeError
  );
});
