import assert from 'node:assert/strict';
import http from 'node:http';
import test, { mock, beforeEach, afterEach } from 'node:test';
import express from 'express';
import { AuditLog } from '../src/models/AuditLog.js';
import { auditForbiddenResponses } from '../src/events/audit.js';
import { buildProblemDetail, requireRole, requireTenantAccess } from '../src/services/sessionService.js';
import { createMemoryModel } from './helpers/memoryModel.js';

let audits;

beforeEach(() => {
  audits = createMemoryModel({ unique: ['seq', 'prevHash'] });
  mock.method(AuditLog, 'findOne', (...args) => audits.findOne(...args));
  mock.method(AuditLog, 'create', (doc) => audits.create(doc));
});

afterEach(() => mock.restoreAll());

function createApp() {
  const app = express();
  app.use((req, _res, next) => {
    req.sessionUser = req.headers['x-role'] ? { id: 'adm-1', role: req.headers['x-role'], cinemaSlugs: ['lumiere'] } : null;
    req.tenant = req.headers['x-tenant'] ? { slug: req.headers['x-tenant'], status: 'ACTIVE', db: null } : undefined;
    next();
  });
  app.use(auditForbiddenResponses);
  app.get('/api/admin/cinemas', requireRole('SUPER_ADMIN'), (_req, res) => res.json({ ok: true }));
  app.get('/api/slots/manage', requireTenantAccess, (_req, res) => res.json({ ok: true }));
  app.post('/api/admin/session/mfa/verify', (_req, res) => res
    .status(403)
    .type('application/problem+json')
    .json(buildProblemDetail(403, 'Forbidden', 'Code MFA invalide.')));
  return app;
}

async function call(app, method, path, headers = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers });
    return { status: res.status, auditCountAtResponse: audits.docs.length, body: await res.json().catch(() => null) };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('403 from the real requireRole is audited before the response', async () => {
  const res = await call(createApp(), 'GET', '/api/admin/cinemas?x=1', { 'x-role': 'CINEMA_ADMIN' });
  assert.equal(res.status, 403);
  assert.equal(res.auditCountAtResponse, 1);
  const [entry] = audits.docs;
  assert.equal(entry.action, 'ACCESS_DENIED');
  assert.equal(entry.result, 'DENIED');
  assert.deepEqual(entry.actor, { id: 'adm-1', role: 'CINEMA_ADMIN' });
  assert.equal(entry.target.id, 'GET /api/admin/cinemas');
});

test('403 from requireTenantAccess carries the tenant slug', async () => {
  const res = await call(createApp(), 'GET', '/api/slots/manage', { 'x-role': 'CINEMA_ADMIN', 'x-tenant': 'rex' });
  assert.equal(res.status, 403);
  assert.equal(audits.docs[0].target.cinemaSlug, 'rex');
});

test('MFA failure is audited as MFA_FAILED', async () => {
  const res = await call(createApp(), 'POST', '/api/admin/session/mfa/verify', { 'x-role': 'SUPER_ADMIN' });
  assert.equal(res.status, 403);
  assert.equal(res.body.detail, 'Code MFA invalide.');
  assert.equal(audits.docs[0].action, 'MFA_VERIFY');
  assert.equal(audits.docs[0].result, 'MFA_FAILED');
});

test('allowed requests and anonymous 401 are not audited', async () => {
  assert.equal((await call(createApp(), 'GET', '/api/admin/cinemas', { 'x-role': 'SUPER_ADMIN' })).status, 200);
  assert.equal((await call(createApp(), 'GET', '/api/admin/cinemas')).status, 401);
  assert.equal(audits.docs.length, 0);
});

test('denial still refused (503) when the audit cannot be written', async () => {
  mock.method(AuditLog, 'create', async () => { throw new Error('mongo down'); });
  const original = console.error;
  console.error = () => {};
  try {
    const res = await call(createApp(), 'GET', '/api/admin/cinemas', { 'x-role': 'SPECTATOR' });
    assert.equal(res.status, 503);
    assert.equal(JSON.stringify(res.body).includes('ok'), false);
  } finally {
    console.error = original;
  }
});
