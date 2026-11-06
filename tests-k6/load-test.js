import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.TARGET_URL || 'http://backend:3000';
const HOST_HEADER = { Host: __ENV.TARGET_HOST || 'cineslot.localhost' };
const MAX_VUS = parseInt(__ENV.MAX_VUS || '500', 10);
const MAX_PING_MS = parseInt(__ENV.MAX_PING_MS || '500', 10);

const postMovieDuration = new Trend('post_movie_duration');
const deleteMovieDuration = new Trend('delete_movie_duration');
const customErrorRate = new Rate('custom_error_rate');

const STAGE_10_PCT = Math.max(1, Math.round(MAX_VUS * 0.10));
const STAGE_30_PCT = Math.max(1, Math.round(MAX_VUS * 0.30));
const STAGE_60_PCT = Math.max(1, Math.round(MAX_VUS * 0.60));
const STAGE_100_PCT = MAX_VUS;

export const options = {
  stages: [
    { duration: '15s', target: STAGE_10_PCT },
    { duration: '15s', target: STAGE_30_PCT },
    { duration: '20s', target: STAGE_60_PCT },
    { duration: '20s', target: STAGE_100_PCT },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: [`p(95)<${MAX_PING_MS}`, 'p(99)<1200'],
    http_req_failed: ['rate<0.01'],
    custom_error_rate: ['rate<0.01'],
  },
};

const GENRES = ['Sci-Fi', 'Action', 'Drama', 'Adventure', 'Crime'];

export function setup() {
  // Un compte jetable par run, cookie partagé entre les VUs (rate limit sur l'auth)
  const loginRes = http.post(
    `${BASE_URL}/api/session/register`,
    JSON.stringify({ email: `k6-${Date.now()}@cineslot.test`, name: 'k6 Tester', password: `k6-${Date.now()}-pwd` }),
    { headers: { 'Content-Type': 'application/json', ...HOST_HEADER } }
  );
  const cookies = loginRes.cookies?.cineslot_session;
  const sessionCookie = cookies && cookies.length > 0 ? cookies[0].value : '';
  return { sessionCookie };
}

export default function (data) {
  const rand = Math.random();
  const authHeader = data?.sessionCookie
    ? { ...HOST_HEADER, Cookie: `cineslot_session=${data.sessionCookie}` }
    : { ...HOST_HEADER };

  if (rand < 0.25) {
    const res = http.get(`${BASE_URL}/health`, { headers: HOST_HEADER });
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);
  } else if (rand < 0.65) {
    const res = http.get(`${BASE_URL}/api/movies`, { headers: HOST_HEADER });
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);
  } else if (rand < 0.85) {
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const res = http.get(`${BASE_URL}/api/movies?genre=${genre}&minRating=7`, { headers: HOST_HEADER });
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);
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
    const params = {
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
    };
    const res = http.post(`${BASE_URL}/api/movies`, payload, params);
    postMovieDuration.add(res.timings.duration);
    const postOk = check(res, { 'created 201': (r) => r.status === 201 });
    customErrorRate.add(!postOk);

    if (postOk) {
      try {
        const body = JSON.parse(res.body);
        const movieId = body?.data?._id;
        if (movieId) {
          const delRes = http.del(`${BASE_URL}/api/movies/${movieId}`, null, { headers: authHeader });
          deleteMovieDuration.add(delRes.timings.duration);
          const delOk = check(delRes, { 'deleted 200': (r) => r.status === 200 });
          customErrorRate.add(!delOk);
        }
      } catch {
        customErrorRate.add(1);
      }
    }
  }

  sleep(Math.random() * 0.2 + 0.1);
}

export function teardown(data) {
  const authHeader = data?.sessionCookie
    ? { ...HOST_HEADER, Cookie: `cineslot_session=${data.sessionCookie}` }
    : { ...HOST_HEADER };
  const res = http.get(`${BASE_URL}/api/movies?limit=100`, { headers: HOST_HEADER });
  if (res.status === 200) {
    try {
      const payload = JSON.parse(res.body);
      const residual = (payload.data || []).filter(
        (m) => m.director === 'k6 Tester' || (m.title && m.title.startsWith('Film k6'))
      );
      for (const m of residual) {
        http.del(`${BASE_URL}/api/movies/${m._id}`, null, { headers: authHeader });
      }
      console.log(`Teardown complete (${residual.length} residual movies removed).`);
    } catch (e) {
      console.error('Teardown error:', e);
    }
  }
}
