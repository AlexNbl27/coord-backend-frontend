import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Configuration de l'URL cible
const BASE_URL = __ENV.TARGET_URL || 'http://backend:3000';

// Capacité maximale ciblée (par défaut 500 VUs)
const MAX_VUS = parseInt(__ENV.MAX_VUS || '500', 10);

// Marge de tolérance de ping (latence maximale tolérée en ms pour 95% des requêtes)
const MAX_PING_MS = parseInt(__ENV.MAX_PING_MS || '500', 10);

// Métriques personnalisées
const postMovieDuration = new Trend('post_movie_duration');
const deleteMovieDuration = new Trend('delete_movie_duration');
const customErrorRate = new Rate('custom_error_rate');

// Calcul dynamique des paliers en % du maximum
const STAGE_10_PCT = Math.max(1, Math.round(MAX_VUS * 0.10)); // 10% du MAX
const STAGE_30_PCT = Math.max(1, Math.round(MAX_VUS * 0.30)); // 30% du MAX
const STAGE_60_PCT = Math.max(1, Math.round(MAX_VUS * 0.60)); // 60% du MAX
const STAGE_100_PCT = MAX_VUS;                                // 100% du MAX (Point de rupture)

// ==============================================================================
// 📈 PALIERS CALCULÉS EN POURCENTAGES DU MAXIMUM :
// Palier 1 : 10% du MAX (Warmup)
// Palier 2 : 30% du MAX (Charge nominale)
// Palier 3 : 60% du MAX (Forte affluence / zone limite)
// Palier 4 : 100% du MAX (Point de rupture ciblé)
// Palier 5 : 0% du MAX (Descente et récupération)
// ==============================================================================
export const options = {
  stages: [
    { duration: '15s', target: STAGE_10_PCT },
    { duration: '15s', target: STAGE_30_PCT },
    { duration: '20s', target: STAGE_60_PCT },
    { duration: '20s', target: STAGE_100_PCT },
    { duration: '10s', target: 0 },
  ],

  thresholds: {
    // 95% des requêtes doivent répondre sous la marge de ping tolérée
    http_req_duration: [`p(95)<${MAX_PING_MS}`, 'p(99)<1200'],
    // Moins de 1% d'erreurs HTTP autorisées
    http_req_failed: ['rate<0.01'],
    // Taux d'échec sur les vérifications fonctionnelles
    custom_error_rate: ['rate<0.01'],
  },
};

const GENRES = ['Sci-Fi', 'Action', 'Drama', 'Adventure', 'Crime'];

export default function () {
  const rand = Math.random();

  if (rand < 0.25) {
    // 1. Healthcheck
    const res = http.get(`${BASE_URL}/health`);
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);

  } else if (rand < 0.65) {
    // 2. Listing des films
    const res = http.get(`${BASE_URL}/api/movies`);
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);

  } else if (rand < 0.85) {
    // 3. Filtrage dynamique
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const res = http.get(`${BASE_URL}/api/movies?genre=${genre}&minRating=7`);
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);

  } else {
    // 4. Écriture & Suppression immédiate (Validation du cycle CRUD sous charge)
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
    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/movies`, payload, params);
    postMovieDuration.add(res.timings.duration);
    const postOk = check(res, { 'created 201': (r) => r.status === 201 });
    customErrorRate.add(!postOk);

    // Test de suppression (DELETE) pour nettoyer au fur et à mesure et tester la route
    if (postOk) {
      try {
        const body = JSON.parse(res.body);
        const movieId = body?.data?._id;
        if (movieId) {
          const delRes = http.del(`${BASE_URL}/api/movies/${movieId}`);
          deleteMovieDuration.add(delRes.timings.duration);
          const delOk = check(delRes, { 'deleted 200': (r) => r.status === 200 });
          customErrorRate.add(!delOk);
        }
      } catch (e) {
        customErrorRate.add(1);
      }
    }
  }

  sleep(Math.random() * 0.2 + 0.1);
}

// Nettoyage final de sécurité en fin de test (teardown k6)
export function teardown() {
  console.log('🧹 Exécution du teardown k6 : vérification et nettoyage des résidus...');
  // Récupérer et purger les éventuels films k6 restants
  const res = http.get(`${BASE_URL}/api/movies?limit=100`);
  if (res.status === 200) {
    try {
      const payload = JSON.parse(res.body);
      const residual = (payload.data || []).filter(
        (m) => m.director === 'k6 Tester' || (m.title && m.title.startsWith('Film k6'))
      );
      for (const m of residual) {
        http.del(`${BASE_URL}/api/movies/${m._id}`);
      }
      console.log(`✅ Nettoyage terminé (${residual.length} films résiduels supprimés).`);
    } catch (e) {
      console.error('Erreur lors du teardown:', e);
    }
  }
}
