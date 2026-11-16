import { STATUS_CODES } from 'node:http';
import { trace, isSpanContextValid, SpanStatusCode } from '@opentelemetry/api';
import { sendProblem } from '../services/sessionService.js';

const GENERIC_CLIENT_DETAIL = 'La requête n\'a pas pu être traitée.';
const GENERIC_SERVER_DETAIL = 'Le service est momentanément indisponible.';

function isFrameworkError(err) {
  return typeof err?.type === 'string' || err instanceof SyntaxError || err?.expose !== undefined;
}

export function errorHandler(err, _req, res, _next) {
  const span = trace.getActiveSpan();
  const ctx = span?.spanContext();
  if (span) {
    span.setStatus({ code: SpanStatusCode.ERROR, message: err?.name || 'Error' });
  }
  if (ctx && isSpanContextValid(ctx) && !res.headersSent) {
    res.setHeader('X-Trace-Id', ctx.traceId);
  }
  const rawStatus = Number(err?.status || err?.statusCode);
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  let detail = GENERIC_SERVER_DETAIL;
  if (status < 500) {
    detail = isFrameworkError(err) || typeof err?.message !== 'string' ? GENERIC_CLIENT_DETAIL : err.message;
  }
  return sendProblem(res, status, STATUS_CODES[status] || 'Error', detail);
}
