import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const MFA_KEY_SOURCE = process.env.MFA_ENCRYPTION_KEY || process.env.SESSION_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('MFA_ENCRYPTION_KEY environment variable is required in production'); })()
    : 'dev-only-ephemeral-hmac-secret-key-32bytes'
);

function deriveAesKey() {
  return crypto.createHash('sha256').update(MFA_KEY_SOURCE).digest();
}

export function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(input) {
  const clean = String(input).toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) {
      throw new Error('Invalid base32 character');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return encodeBase32(crypto.randomBytes(20));
}

export function encryptTotpSecret(secret) {
  const key = deriveAesKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptTotpSecret(payload) {
  if (typeof payload !== 'string') {
    return null;
  }
  const parts = payload.split('.');
  if (parts.length !== 3) {
    return null;
  }
  try {
    const [ivB64, tagB64, dataB64] = parts;
    const key = deriveAesKey();
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final()
    ]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function generateTotpCode(secret, nowMs = Date.now(), stepOffset = 0) {
  const key = decodeBase32(secret);
  const counter = Math.floor(nowMs / 1000 / TOTP_STEP_SECONDS) + stepOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  ) % (10 ** TOTP_DIGITS);
  return String(code).padStart(TOTP_DIGITS, '0');
}

export function verifyTotpCode(secret, code, nowMs = Date.now(), window = 1) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    return false;
  }
  const providedBuf = Buffer.from(code, 'utf8');
  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateTotpCode(secret, nowMs, offset);
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (crypto.timingSafeEqual(providedBuf, expectedBuf)) {
      return true;
    }
  }
  return false;
}

export function buildTotpUri(secret, email, issuer = 'CineSlot') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}
