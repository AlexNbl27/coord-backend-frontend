import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createTicketRouter } from '../src/routes/ticketRoutes.js';
import {
  createAttachSession,
  SESSION_COOKIE_NAME,
  signSessionToken
} from '../src/services/sessionService.js';
import { CANCELLED_MESSAGE, NOT_FOUND_MESSAGE } from '../src/services/ticketService.js';

function createTestApp(buildTicketStub) {
  const app = express();
  app.use(cookieParser());
  app.use(createAttachSession({ exists: async () => ({}) }));
  app.use('/api/bookings', createTicketRouter({ buildTicket: buildTicketStub }));
  return app;
}

async function request(app, path, headers = {}) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    const body = Buffer.from(await res.arrayBuffer());
    return { status: res.status, headers: res.headers, body };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const VALID_COOKIE = `${SESSION_COOKIE_NAME}=${signSessionToken({ id: 'spectator-1', name: 'Hélène Durand', email: 'helene@cineslot.test' })}`;

test('ticketRoutes: returns 200 with inline PDF and security headers', async () => {
  const samplePdf = Buffer.from('%PDF-1.4\n%sample');
  const app = createTestApp(async () => ({
    pdf: samplePdf,
    filename: 'ticket-abc123.pdf'
  }));

  const res = await request(app, '/api/bookings/abc123/ticket.pdf', {
    Cookie: VALID_COOKIE
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('content-disposition'), 'inline; filename="ticket-abc123.pdf"');
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('content-length'), String(samplePdf.length));
  assert.deepEqual(res.body, samplePdf);
});

test('ticketRoutes: sets attachment disposition when download=true', async () => {
  const samplePdf = Buffer.from('%PDF-1.4\n%sample');
  const app = createTestApp(async () => ({
    pdf: samplePdf,
    filename: 'ticket-abc123.pdf'
  }));

  const res = await request(app, '/api/bookings/abc123/ticket.pdf?download=true', {
    Cookie: VALID_COOKIE
  });

  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-disposition'), 'attachment; filename="ticket-abc123.pdf"');
});

test('ticketRoutes: returns 401 ProblemDetail when session cookie is missing', async () => {
  const app = createTestApp(async () => {
    throw new Error('Should not be called');
  });

  const res = await request(app, '/api/bookings/abc123/ticket.pdf');
  assert.equal(res.status, 401);
  assert.match(res.headers.get('content-type') || '', /application\/problem\+json/);
  const json = JSON.parse(res.body.toString('utf8'));
  assert.equal(json.status, 401);
  assert.ok(json.detail);
});

test('ticketRoutes: maps 404 and 409 errors to ProblemDetail', async () => {
  const app404 = createTestApp(async () => {
    const err = new Error(NOT_FOUND_MESSAGE);
    err.status = 404;
    throw err;
  });
  const res404 = await request(app404, '/api/bookings/other/ticket.pdf', {
    Cookie: VALID_COOKIE
  });
  assert.equal(res404.status, 404);
  assert.equal(JSON.parse(res404.body.toString('utf8')).detail, NOT_FOUND_MESSAGE);

  const app409 = createTestApp(async () => {
    const err = new Error(CANCELLED_MESSAGE);
    err.status = 409;
    throw err;
  });
  const res409 = await request(app409, '/api/bookings/cancelled/ticket.pdf', {
    Cookie: VALID_COOKIE
  });
  assert.equal(res409.status, 409);
  assert.equal(JSON.parse(res409.body.toString('utf8')).detail, CANCELLED_MESSAGE);
});
