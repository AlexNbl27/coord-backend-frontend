import { isValidSlug } from '../tenancy/slug.js';

export const SSE_BROADCAST_TYPE = 'BROADCAST_SSE';
export const SSE_EVENTS = new Set(['ready', 'slot-updated', 'cinema-status']);
const MAX_PAYLOAD_BYTES = 4096;

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isValidSseBroadcast(msg) {
  if (!isPlainObject(msg) || msg.type !== SSE_BROADCAST_TYPE) {
    return false;
  }
  if (!isValidSlug(msg.slug) || !SSE_EVENTS.has(msg.eventName) || !isPlainObject(msg.payload)) {
    return false;
  }
  if (!Number.isInteger(msg.originPid)) {
    return false;
  }
  try {
    return JSON.stringify(msg.payload).length <= MAX_PAYLOAD_BYTES;
  } catch {
    return false;
  }
}

export function isValidCinemaCacheMessage(msg) {
  return isPlainObject(msg)
    && msg.type === 'CLEAR_CINEMA_CACHE'
    && (msg.slug === null || isValidSlug(msg.slug))
    && Number.isInteger(msg.originPid);
}

export function isForwardableIpcMessage(msg) {
  if (!isPlainObject(msg)) {
    return false;
  }
  if (msg.type === SSE_BROADCAST_TYPE) {
    return isValidSseBroadcast(msg);
  }
  if (msg.type === 'CLEAR_CINEMA_CACHE') {
    return isValidCinemaCacheMessage(msg);
  }
  return msg.type === 'CLEAR_MOVIE_CACHE';
}
