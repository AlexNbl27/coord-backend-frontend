import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import {
  broadcastCinemaStatus,
  broadcastSlotChange,
  getSseStats,
  subscribeSse
} from '../src/services/slotService.js';
import { isForwardableIpcMessage, isValidSseBroadcast } from '../src/services/sseMessages.js';

function fakeRes({ failWrites = false } = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    chunks: [],
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    flushHeaders() {},
    write(chunk) {
      if (failWrites && this.chunks.length >= failWrites) {
        throw new Error('socket fermée');
      }
      this.chunks.push(chunk);
      return true;
    },
    status(code) { this.statusCode = code; return this; },
    type(value) { this.headers['content-type'] = value; return this; },
    json(body) { this.body = body; return this; }
  };
  return res;
}

function events(res) {
  return res.chunks
    .filter((c) => c.startsWith('event: '))
    .map((c) => {
      const [eventLine, dataLine] = c.split('\n');
      return { event: eventLine.slice('event: '.length), data: JSON.parse(dataLine.slice('data: '.length)) };
    });
}

function connect(slug, ip = '10.0.0.1', opts = {}) {
  const req = new EventEmitter();
  req.tenant = slug ? { slug, status: 'ACTIVE' } : null;
  req.ip = ip;
  const res = fakeRes(opts);
  subscribeSse(req, res);
  return { req, res, close: () => req.emit('close') };
}

test('SSE : à la connexion, ready puis cinema-status du tenant', (t) => {
  const a = connect('cine-a');
  t.after(a.close);
  assert.equal(a.res.headers['content-type'], 'text/event-stream');
  assert.deepEqual(events(a.res), [
    { event: 'ready', data: { action: 'reload' } },
    { event: 'cinema-status', data: { slug: 'cine-a', status: 'ACTIVE' } }
  ]);
});

test('SSE : sans tenant, 404 problem+json', () => {
  const none = connect(null);
  assert.equal(none.res.statusCode, 404);
  assert.match(none.res.headers['content-type'], /problem\+json/);
});

test('SSE : un slot-updated du tenant A ne parvient pas au tenant B', (t) => {
  const a = connect('cine-a', '10.0.0.2');
  const b = connect('cine-b', '10.0.0.3');
  t.after(() => { a.close(); b.close(); });

  broadcastSlotChange({ _id: 'slot-1', status: 'AVAILABLE', version: 3, capacity: 40, availableSeats: 38 }, 'cine-a');
  broadcastCinemaStatus('cine-b', 'DISABLED');

  const aEvents = events(a.res).slice(2);
  const bEvents = events(b.res).slice(2);
  assert.deepEqual(aEvents, [{ event: 'slot-updated', data: { slotId: 'slot-1', status: 'AVAILABLE', version: 3, capacity: 40, availableSeats: 38 } }]);
  assert.deepEqual(bEvents, [{ event: 'cinema-status', data: { slug: 'cine-b', status: 'DISABLED' } }]);
});

test('SSE : diffusion ignorée pour un slug invalide', (t) => {
  const a = connect('cine-a', '10.0.0.4');
  t.after(a.close);
  broadcastSlotChange({ _id: 'slot-1', status: 'AVAILABLE', version: 1 }, undefined);
  broadcastSlotChange({ _id: 'slot-1', status: 'AVAILABLE', version: 1 }, 'admin');
  assert.equal(events(a.res).length, 2);
});

test('SSE : plafond de connexions par IP, libéré à la fermeture', (t) => {
  const ip = '10.0.0.50';
  const opened = [];
  t.after(() => opened.forEach((c) => c.close()));
  for (let i = 0; i < 10; i += 1) {
    const c = connect(i % 2 ? 'cine-a' : 'cine-b', ip);
    assert.equal(c.res.headers['content-type'], 'text/event-stream');
    opened.push(c);
  }
  const rejected = connect('cine-a', ip);
  assert.equal(rejected.res.statusCode, 429);
  assert.equal(rejected.res.headers['retry-after'], '30');

  const otherIp = connect('cine-a', '10.0.0.51');
  opened.push(otherIp);
  assert.equal(otherIp.res.headers['content-type'], 'text/event-stream');

  opened.shift().close();
  const again = connect('cine-a', ip);
  opened.push(again);
  assert.equal(again.res.headers['content-type'], 'text/event-stream');
  assert.equal(getSseStats().byIp[ip], 10);
});

test('SSE : un client dont l’écriture initiale échoue n’est pas compté', () => {
  const before = getSseStats().total;
  const broken = connect('cine-y', '10.0.0.61', { failWrites: 1 });
  assert.equal(getSseStats().total, before);
  assert.equal(getSseStats().byIp['10.0.0.61'], undefined);
  broken.close();
  assert.equal(getSseStats().total, before);
});

test('SSE : un client dont l’écriture échoue est retiré des compteurs', () => {
  const before = getSseStats().total;
  const broken = connect('cine-z', '10.0.0.60', { failWrites: 2 });
  assert.equal(getSseStats().total, before + 1);
  broadcastCinemaStatus('cine-z', 'DISABLED');
  assert.equal(getSseStats().total, before);
  assert.equal(getSseStats().byIp['10.0.0.60'], undefined);
  broken.close();
  assert.equal(getSseStats().total, before);
});

test('SSE : message IPC d’un autre worker relayé uniquement au bon tenant', (t) => {
  const a = connect('cine-a', '10.0.0.70');
  const b = connect('cine-b', '10.0.0.71');
  t.after(() => { a.close(); b.close(); });
  const base = { type: 'BROADCAST_SSE', eventName: 'cinema-status', originPid: process.pid + 1 };

  process.emit('message', { ...base, slug: 'cine-a', payload: { slug: 'cine-a', status: 'DISABLED' } });
  process.emit('message', { ...base, slug: 'admin', payload: { slug: 'admin', status: 'DISABLED' } });
  process.emit('message', { ...base, slug: 'cine-b', eventName: 'evil', payload: {} });
  process.emit('message', { ...base, payload: { status: 'DISABLED' } });
  process.emit('message', { ...base, slug: 'cine-b', payload: 'x' });

  assert.deepEqual(events(a.res).slice(2), [{ event: 'cinema-status', data: { slug: 'cine-a', status: 'DISABLED' } }]);
  assert.deepEqual(events(b.res).slice(2), []);
});

test('IPC : le primaire ne relaie que des messages valides', () => {
  const ok = { type: 'BROADCAST_SSE', slug: 'cine-a', eventName: 'slot-updated', payload: { slotId: 's' }, originPid: 1 };
  assert.equal(isValidSseBroadcast(ok), true);
  assert.equal(isForwardableIpcMessage(ok), true);
  assert.equal(isForwardableIpcMessage({ ...ok, slug: undefined }), false);
  assert.equal(isForwardableIpcMessage({ ...ok, slug: 'config' }), false);
  assert.equal(isForwardableIpcMessage({ ...ok, eventName: 'message' }), false);
  assert.equal(isForwardableIpcMessage({ ...ok, payload: [] }), false);
  assert.equal(isForwardableIpcMessage({ ...ok, originPid: 'x' }), false);
  assert.equal(isForwardableIpcMessage({ ...ok, payload: { big: 'x'.repeat(5000) } }), false);
  assert.equal(isForwardableIpcMessage({ type: 'CLEAR_CINEMA_CACHE', slug: 'cine-a', originPid: 1 }), true);
  assert.equal(isForwardableIpcMessage({ type: 'CLEAR_CINEMA_CACHE', slug: null, originPid: 1 }), true);
  assert.equal(isForwardableIpcMessage({ type: 'CLEAR_CINEMA_CACHE', slug: '../x', originPid: 1 }), false);
  assert.equal(isForwardableIpcMessage({ type: 'CLEAR_MOVIE_CACHE', originPid: 1 }), true);
  assert.equal(isForwardableIpcMessage({ type: 'SHUTDOWN' }), false);
  assert.equal(isForwardableIpcMessage(null), false);
});
