import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AUDIT_GENESIS_HASH,
  createAuditAppender,
  resolveAuditKey,
  verifyAuditChain
} from '../src/events/audit.js';
import { createMemoryModel } from './helpers/memoryModel.js';

const KEY = 'test-audit-key-0123456789abcdef0123456789';

async function seedChain() {
  const audits = createMemoryModel({ unique: ['seq', 'prevHash'] });
  const append = createAuditAppender({ audits, key: KEY });
  await append({ actor: { id: 'root', role: 'SUPER_ADMIN' }, action: 'CINEMA_DISABLE', target: { type: 'cinema', id: 'lumiere', cinemaSlug: 'lumiere' }, before: { status: 'ACTIVE' }, after: { status: 'DISABLED' } });
  await append({ actor: { id: 'u-1', role: 'SPECTATOR' }, action: 'ACCESS_DENIED', target: { type: 'route', id: 'POST /api/slots/reset' }, result: 'DENIED' });
  await append({ actor: { id: 'adm', role: 'CINEMA_ADMIN' }, action: 'MFA_VERIFY', target: null, result: 'MFA_FAILED' });
  await append({ actor: { id: 'root', role: 'SUPER_ADMIN' }, action: 'MOVIE_UPDATE', target: { type: 'movie', id: 'm1' }, before: {}, after: { year: 2024, genres: ['SF'] } });
  return audits;
}

const sorted = (audits) => [...audits.docs].sort((a, b) => a.seq - b.seq);

test('appendAudit builds a continuous HMAC chain', async () => {
  const audits = await seedChain();
  const entries = sorted(audits);
  assert.deepEqual(entries.map((e) => e.seq), [1, 2, 3, 4]);
  assert.equal(entries[0].prevHash, AUDIT_GENESIS_HASH);
  for (let i = 1; i < entries.length; i += 1) {
    assert.equal(entries[i].prevHash, entries[i - 1].hash);
  }
  assert.deepEqual(entries[3].before, {}, 'empty objects survive');
  const report = await verifyAuditChain(entries, KEY);
  assert.deepEqual(report, { ok: true, count: 4, lastHash: entries[3].hash });
});

test('verifier detects a tampered field', async () => {
  for (const tamper of [
    (e) => { e[1].result = 'SUCCESS'; },
    (e) => { e[0].after.status = 'ACTIVE'; },
    (e) => { e[2].actor.role = 'SUPER_ADMIN'; },
    (e) => { e[3].at = new Date(e[3].at.getTime() + 1); },
    (e) => { e[3].after.genres.push('Drame'); }
  ]) {
    const entries = sorted(await seedChain());
    tamper(entries);
    const report = await verifyAuditChain(entries, KEY);
    assert.equal(report.ok, false);
    assert.equal(report.reason, 'HASH_MISMATCH');
  }
});

test('verifier detects deletion, reordering and a recomputed hash without the key', async () => {
  const removed = sorted(await seedChain());
  removed.splice(1, 1);
  assert.deepEqual(await verifyAuditChain(removed, KEY), { ok: false, count: 1, brokenAt: 3, reason: 'SEQ_GAP' });

  const relinked = sorted(await seedChain());
  relinked.splice(1, 1);
  relinked.slice(1).forEach((e, i) => { e.seq = i + 2; });
  assert.equal((await verifyAuditChain(relinked, KEY)).reason, 'PREV_HASH_MISMATCH');

  const forged = sorted(await seedChain());
  const attacker = createMemoryModel({ unique: ['seq', 'prevHash'] });
  const appendForged = createAuditAppender({ audits: attacker, key: 'attacker-guess' });
  const fake = await appendForged({ actor: { id: 'evil' }, action: 'CINEMA_DISABLE', result: 'SUCCESS' });
  forged[0] = { ...fake };
  const report = await verifyAuditChain(forged, KEY);
  assert.equal(report.ok, false);
  assert.equal(report.brokenAt, 1);
});

test('concurrent appends retry on duplicate key and keep the chain valid', async () => {
  const audits = createMemoryModel({ unique: ['seq', 'prevHash'] });
  const append = createAuditAppender({ audits, key: KEY });
  await Promise.all(Array.from({ length: 6 }, (_, i) => append({ actor: { id: `a${i}` }, action: 'PARALLEL', result: 'SUCCESS' })));
  const report = await verifyAuditChain(sorted(audits), KEY);
  assert.equal(report.ok, true);
  assert.equal(report.count, 6);
});

test('resolveAuditKey: required in production and distinct from SESSION_SECRET', () => {
  assert.throws(() => resolveAuditKey({ NODE_ENV: 'production' }), /AUDIT_KEY/);
  assert.throws(() => resolveAuditKey({ AUDIT_KEY: 'same-secret', SESSION_SECRET: 'same-secret' }), /distinct/);
  assert.throws(() => resolveAuditKey({ NODE_ENV: 'production', AUDIT_KEY: 'short' }), /32/);
  assert.equal(resolveAuditKey({ AUDIT_KEY: KEY, SESSION_SECRET: 'other' }), KEY);
  assert.ok(resolveAuditKey({}).length >= 32);
});

test('appendAudit normalizes string actor and target used by existing callers', async () => {
  const audits = createMemoryModel({ unique: ['seq', 'prevHash'] });
  const append = createAuditAppender({ audits, key: KEY });
  await append({ actor: 'root', action: 'CINEMA_STATUS_UPDATE', target: 'lumiere', before: { status: 'ACTIVE' }, after: { status: 'DISABLED' } });
  await append({ actor: 'system:purge-job', action: 'CINEMA_PURGE', target: 'not a slug!' });
  const [first, second] = sorted(audits);
  assert.deepEqual(first.actor, { id: 'root', role: null });
  assert.deepEqual(first.target, { type: null, id: 'lumiere', cinemaSlug: 'lumiere' });
  assert.deepEqual(second.target, { type: null, id: 'not a slug!', cinemaSlug: null });
  assert.equal((await verifyAuditChain(sorted(audits), KEY)).ok, true);
});
