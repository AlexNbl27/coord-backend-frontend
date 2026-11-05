export const RESERVED_SLUGS = new Set([
  'admin', 'api', 'www', 'master', 'cineslot', 'config', 'local',
  'static', 'assets', 'otlp', 'mail', 'auth', 'login', 'root', 'test'
]);

export const SLUG_PATTERN = /^[a-z](?:[a-z0-9]|-(?!-)){1,28}[a-z0-9]$/;

export const TENANT_DB_PREFIX = 'cinema_';

export function isValidSlug(s) {
  return typeof s === 'string' && SLUG_PATTERN.test(s) && !RESERVED_SLUGS.has(s);
}

export function tenantDbName(slug) {
  if (!isValidSlug(slug)) throw new TypeError('Slug de cinéma invalide ou réservé.');
  return `${TENANT_DB_PREFIX}${slug}`;
}
