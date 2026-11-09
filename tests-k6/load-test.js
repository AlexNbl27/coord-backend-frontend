import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.TARGET_URL || 'http://backend:3000';
const MAX_VUS = parseInt(__ENV.MAX_VUS || '500', 10);
const MAX_PING_MS = parseInt(__ENV.MAX_PING_MS || '500', 10);
const ROOT_DOMAIN = __ENV.K6_ROOT_DOMAIN || 'cineslot.localhost:3001';
const TENANTS = (__ENV.K6_TENANTS || 'cine-bellecour,cine-part-dieu').split(',').map((s) => s.trim()).filter(Boolean);
const ADMIN_HOST = `admin.${ROOT_DOMAIN}`;
const ADMIN_EMAIL = __ENV.K6_ADMIN_EMAIL || '';
const ADMIN_PASSWORD = __ENV.K6_ADMIN_PASSWORD || '';

const postMovieDuration = new Trend('post_movie_duration');
const deleteMovieDuration = new Trend('delete_movie_duration');
const statsDuration = new Trend('admin_stats_duration');
const customErrorRate = new Rate('custom_error_rate');

const STAGE_10_PCT = Math.max(1, Math.round(MAX_VUS * 0.10));
const STAGE_30_PCT = Math.max(1, Math.round(MAX_VUS * 0.30));
const STAGE_60_PCT = Math.max(1, Math.round(MAX_VUS * 0.60));
const STAGE_100_PCT = MAX_VUS;

export const options = {
  scenarios: {
    spectators: {
      executor: 'ramping-vus',
      exec: 'spectator',
      stages: [
        { duration: '15s', target: STAGE_10_PCT },
        { duration: '15s', target: STAGE_30_PCT },
        { duration: '20s', target: STAGE_60_PCT },
        { duration: '20s', target: STAGE_100_PCT },
        { duration: '10s', target: 0 },
      ],
    },
    admins: {
      executor: 'constant-vus',
      exec: 'admin',
      vus: Math.max(1, Math.round(MAX_VUS * 0.02)),
      duration: '80s',
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${MAX_PING_MS}`, 'p(99)<1200'],
    http_req_failed: ['rate<0.01'],
    custom_error_rate: ['rate<0.01'],
  },
};

const GENRES = ['Sci-Fi', 'Action', 'Drama', 'Adventure', 'Crime'];

const tenantHost = () => `${TENANTS[Math.floor(Math.random() * TENANTS.length)]}.${ROOT_DOMAIN}`;
const onHost = (host, extra = {}) => ({ headers: { Host: host, ...extra } });

function cookieHeader(res) {
  return Object.entries(res.cookies || {})
    .filter(([, values]) => values.length > 0)
    .map(([name, values]) => `${name}=${values[0].value}`)
    .join('; ');
}

export function setup() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('K6_ADMIN_EMAIL et K6_ADMIN_PASSWORD requis : créer le compte avec backend/scripts/create-admin.js');
  }
  const res = http.post(
    `${BASE_URL}/api/admin/session/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    onHost(ADMIN_HOST, { 'Content-Type': 'application/json' })
  );
  if (res.status !== 200) {
    throw new Error(`Connexion admin impossible (HTTP ${res.status})`);
  }
  return { adminCookie: cookieHeader(res) };
}

function expectOk(res, name, status = 200) {
  const ok = check(res, { [name]: (r) => r.status === status });
  customErrorRate.add(!ok);
  return ok;
}

export function spectator() {
  const host = tenantHost();
  const rand = Math.random();

  if (rand < 0.2) {
    expectOk(http.get(`${BASE_URL}/health`, onHost(host)), 'health 200');
  } else if (rand < 0.5) {
    expectOk(http.get(`${BASE_URL}/api/slots`, onHost(host)), 'tenant slots 200');
  } else if (rand < 0.8) {
    expectOk(http.get(`${BASE_URL}/api/movies`, onHost(host)), 'movies 200');
  } else {
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    expectOk(http.get(`${BASE_URL}/api/movies?genre=${genre}&minRating=7`, onHost(host)), 'movies filter 200');
  }

  sleep(Math.random() * 0.2 + 0.1);
}

export function admin(data) {
  const params = onHost(ADMIN_HOST, { Cookie: data.adminCookie, 'Content-Type': 'application/json' });

  if (Math.random() < 0.5) {
    const tenant = TENANTS[Math.floor(Math.random() * TENANTS.length)];
    const res = http.get(`${BASE_URL}/api/admin/stats/bookings?groupBy=movie&cinema=${tenant}`, params);
    statsDuration.add(res.timings.duration);
    expectOk(res, 'admin stats 200');
  } else {
    const id = `${Date.now()}-${__VU}-${__ITER}`;
    const payload = JSON.stringify({
      title: `Film k6 ${id}`,
      director: 'k6 Tester',
      year: 2026,
      genres: ['Sci-Fi'],
      duration: 120,
      ratings: { imdb: 8.0 },
      synopsis: 'Test palier k6 avec suppression automatique',
    });
    const res = http.post(`${BASE_URL}/api/movies`, payload, params);
    postMovieDuration.add(res.timings.duration);
    if (expectOk(res, 'created 201', 201)) {
      const movieId = res.json('data._id');
      if (movieId) {
        const delRes = http.del(`${BASE_URL}/api/movies/${movieId}`, null, params);
        deleteMovieDuration.add(delRes.timings.duration);
        expectOk(delRes, 'deleted 200');
      } else {
        customErrorRate.add(1);
      }
    }
  }

  sleep(Math.random() * 0.5 + 0.5);
}

export function teardown(data) {
  const params = onHost(ADMIN_HOST, { Cookie: data.adminCookie });
  const res = http.get(`${BASE_URL}/api/movies?limit=100`, params);
  if (res.status !== 200) return;
  const residual = (res.json('data') || []).filter(
    (m) => m.director === 'k6 Tester' || (m.title && m.title.startsWith('Film k6'))
  );
  for (const m of residual) {
    http.del(`${BASE_URL}/api/movies/${m._id}`, null, params);
  }
  console.log(`Teardown complete (${residual.length} residual movies removed).`);
}
