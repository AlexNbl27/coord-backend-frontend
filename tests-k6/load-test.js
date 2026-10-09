import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// Configuration de l'URL cible
const BASE_URL = __ENV.TARGET_URL || 'http://backend:3000';

// Marge de tolérance de ping (latence maximale tolérée en ms pour 95% des requêtes)
const MAX_PING_MS = parseInt(__ENV.MAX_PING_MS || '500', 10);

// Métriques personnalisées
const postMovieDuration = new Trend('post_movie_duration');
const customErrorRate = new Rate('custom_error_rate');

// ==============================================================================
// 📈 PALIERS DE MONTÉE EN CHARGE (Plateaus / Stages)
// Objectif : Trouver le point de rupture de l'API jusqu'à 2000 VUs simultanés
// ==============================================================================
export const options = {
  stages: [
    // Palier 1 : Charge nominale (100 utilisateurs simultanés)
    { duration: '15s', target: 100 },
    { duration: '10s', target: 100 },

    // Palier 2 : Charge élevée (500 utilisateurs simultanés)
    { duration: '15s', target: 500 },
    { duration: '10s', target: 500 },

    // Palier 3 : Forte charge (1000 utilisateurs simultanés)
    { duration: '15s', target: 1000 },
    { duration: '10s', target: 1000 },

    // Palier 4 : Charge extrême / Point de rupture (2000 utilisateurs simultanés)
    { duration: '20s', target: 2000 },
    { duration: '10s', target: 2000 },

    // Palier 5 : Récupération / Descente
    { duration: '15s', target: 0 },
  ],

  // ============================================================================
  // 🎯 MARGE DE TOLÉRANCE DE PING & SEUILS DE QUALITÉ (Thresholds)
  // Si le ping dépasse la marge tolérée ou si le taux d'erreur dépasse 1%,
  // le test devient ROUGE et déclenche la création du ticket GitHub Issues.
  // ============================================================================
  thresholds: {
    // 95% des requêtes doivent répondre dans la marge de ping tolérée
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
    // 1. Healthcheck (requête légère)
    const res = http.get(`${BASE_URL}/health`);
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);

  } else if (rand < 0.65) {
    // 2. Listing des films (requête base de données)
    const res = http.get(`${BASE_URL}/api/movies`);
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);

  } else if (rand < 0.90) {
    // 3. Filtrage dynamique (index & tri MongoDB)
    const genre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const res = http.get(`${BASE_URL}/api/movies?genre=${genre}&minRating=7`);
    const ok = check(res, { 'status is 200': (r) => r.status === 200 });
    customErrorRate.add(!ok);

  } else {
    // 4. Écriture concurrente (création de film)
    const id = `${Date.now()}-${__VU}-${__ITER}`;
    const payload = JSON.stringify({
      title: `Film k6 ${id}`,
      director: 'k6 Tester',
      year: 2026,
      genres: ['Sci-Fi'],
      duration: 120,
      ratings: { imdb: 8.0 },
      synopsis: 'Test palier k6',
    });
    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/movies`, payload, params);
    postMovieDuration.add(res.timings.duration);
    const ok = check(res, { 'created 201': (r) => r.status === 201 });
    customErrorRate.add(!ok);
  }

  // Temps de pause court (entre 0.1s et 0.4s) pour maximiser le parallélisme des requêtes
  sleep(Math.random() * 0.3 + 0.1);
}
