export type Plane = 'tenant' | 'admin' | 'public' | 'unknown';

export interface HostContext {
  plane: Plane;
  slug: string | null;
}

export interface LocationLike {
  protocol: string;
  hostname: string;
  port: string;
}

const SLUG_PATTERN = /^[a-z](?:[a-z0-9]|-(?!-)){1,28}[a-z0-9]$/;
const RESERVED_SLUGS = new Set([
  'admin', 'api', 'www', 'master', 'cineslot', 'config', 'local',
  'static', 'assets', 'otlp', 'mail', 'auth', 'login', 'root', 'test',
]);

export const BASE_DOMAIN = String(import.meta.env.VITE_TENANT_BASE_DOMAIN || 'cineslot.localhost').toLowerCase();

export function isValidSlug(value: unknown): value is string {
  return typeof value === 'string' && SLUG_PATTERN.test(value) && !RESERVED_SLUGS.has(value);
}

export function parseHostContext(hostname: string, baseDomain: string = BASE_DOMAIN): HostContext {
  const host = hostname.trim().toLowerCase();
  if (host === baseDomain) return { plane: 'public', slug: null };
  const suffix = `.${baseDomain}`;
  if (!host.endsWith(suffix)) return { plane: 'unknown', slug: null };
  const label = host.slice(0, -suffix.length);
  if (label === 'admin') return { plane: 'admin', slug: null };
  if (isValidSlug(label)) return { plane: 'tenant', slug: label };
  return { plane: 'unknown', slug: null };
}

export function currentHostContext(): HostContext {
  return parseHostContext(window.location.hostname);
}

function originFor(label: string | null, loc: LocationLike = window.location): string {
  const host = label ? `${label}.${BASE_DOMAIN}` : BASE_DOMAIN;
  const port = loc.port ? `:${loc.port}` : '';
  return `${loc.protocol}//${host}${port}`;
}

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`;
}

export function tenantUrl(slug: string, path = '/', loc: LocationLike = window.location): string {
  if (!isValidSlug(slug)) throw new TypeError('Slug de cinéma invalide.');
  return `${originFor(slug, loc)}${normalizePath(path)}`;
}

export function apexUrl(path = '/', loc: LocationLike = window.location): string {
  return `${originFor(null, loc)}${normalizePath(path)}`;
}

export function adminUrl(path = '/', loc: LocationLike = window.location): string {
  return `${originFor('admin', loc)}${normalizePath(path)}`;
}

const TENANT_ONLY_ROUTES = new Set(['home', 'slots', 'slot-booking', 'reservations']);
const ADMIN_ROUTES = new Set(['admin-cinemas', 'admin-logs', 'admin-stats']);
const ADMIN_PLANE_ROUTES = new Set([...ADMIN_ROUTES, 'login', 'not-found']);

export function planeRedirect(ctx: HostContext, routeName: string | null | undefined): string | null {
  const name = routeName ?? '';
  if (ctx.plane === 'unknown') return null;
  if (ctx.plane === 'admin') {
    return ADMIN_PLANE_ROUTES.has(name) ? null : 'admin-cinemas';
  }
  if (ADMIN_ROUTES.has(name)) return 'not-found';
  if (ctx.plane !== 'tenant' && TENANT_ONLY_ROUTES.has(name)) {
    return 'cinemas';
  }
  if (ctx.plane === 'tenant' && name === 'cinemas') {
    return 'home';
  }
  return null;
}
