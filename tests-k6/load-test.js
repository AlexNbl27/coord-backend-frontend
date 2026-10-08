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
// 📈 PALIERS DE MONTÉE EN CHARGE CALIBRÉS (50 ➔ 150 ➔ 300 ➔ 500 VUs)
// Objectif : Observer les 3 zones de vie de l'API (Confort, Charge, Rupture)
// ==============================================================================
export const options = {
  stages: [
    // Palier 1 : Zone de confort / nominale (50 utilisateurs simultanés)
    { duration: '15s', target: 50 },

    // Palier 2 : Charge soutenue / trafic élevé (150 utilisateurs simultanés)
    { duration: '15s', target: 150 },

    // Palier 3 : Forte affluence / zone limite (300 utilisateurs simultanés)
    { duration: '20s', target: 300 },

    // Palier 4 : POINT DE RUPTURE (500 utilisateurs simultanés)
    // Sature l'Event Loop mono-thread de Node.js et sollicite le pool MongoDB
    { duration: '20s', target: 500 },

    // Palier 5 : Récupération / descente (0 VU)
    { duration: '10s', target: 0 },
  ],

  // ============================================================================
  // 🎯 MARGE DE TOLÉRANCE DE PING & SEUILS DE QUALITÉ (Thresholds)
  // Si le ping p(95) dépasse MAX_PING_MS ou si le taux d'erreur dépasse 1%,
  // le test échoue et déclenche la création automatique du ticket incident.
  // ============================================================================
  thresholds: {
    // 95% des requêtes doivent répondre sous la marge de ping tolérée
    http_req_duration: [`p(95)<${MAX_PING_MS}`, 'p(99)<1000'],
    // Taux d'erreurs HTTP maximal toléré : 1%
    http_req_failed: ['rate<0.01'],
    // Taux d'erreurs fonctionnelles
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
      synopsis: 'Test palier k6 calibré',
    });
    const params = { headers: { 'Content-Type': 'application/json' } };
    const res = http.post(`${BASE_URL}/api/movies`, payload, params);
    postMovieDuration.add(res.timings.duration);
    const ok = check(res, { 'created 201': (r) => r.status === 201 });
    customErrorRate.add(!ok);
  }

  // Temps de pause court (entre 0.1s et 0.3s) pour simuler un comportement utilisateur réel
  sleep(Math.random() * 0.2 + 0.1);
}
