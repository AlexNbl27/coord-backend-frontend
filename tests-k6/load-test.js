import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// URL de base de l'API (définie via variable d'environnement ou valeur par défaut)
const BASE_URL = __ENV.TARGET_URL || 'http://backend:3000';

// Métriques personnalisées
const postMovieDuration = new Trend('post_movie_duration');
const errorRate = new Rate('custom_error_rate');

// Configuration du test de charge progressif (Ramping VUs)
export const options = {
  stages: [
    { duration: '15s', target: 10 }, // 1. Préchauffage : montée progressive à 10 VUs
    { duration: '20s', target: 25 }, // 2. Charge nominale : montée à 25 VUs
    { duration: '20s', target: 50 }, // 3. Pic de charge (stress) : montée à 50 VUs
    { duration: '15s', target: 0 },  // 4. Récupération : descente à 0 VUs
  ],
  thresholds: {
    // Moins de 2% d'erreurs HTTP globales
    http_req_failed: ['rate<0.02'],
    // 95% des requêtes sous 400ms et 99% sous 800ms
    http_req_duration: ['p(95)<400', 'p(99)<800'],
    // Taux d'échec sur nos checks personnalisés
    custom_error_rate: ['rate<0.02'],
    // Temps de création d'un film (POST) p(90) < 500ms
    post_movie_duration: ['p(90)<500'],
  },
};

const GENRES = ['Sci-Fi', 'Action', 'Drama', 'Adventure', 'Crime'];

export default function () {
  // Tirage aléatoire pour varier les types de requêtes
  const rand = Math.random();

  if (rand < 0.20) {
    // ==========================================
    // 1. Healthcheck (20% du trafic)
    // ==========================================
    const healthRes = http.get(`${BASE_URL}/health`);
    const success = check(healthRes, {
      'health status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);

  } else if (rand < 0.60) {
    // ==========================================
    // 2. Listing des films (40% du trafic)
    // ==========================================
    const moviesRes = http.get(`${BASE_URL}/api/movies`);
    const success = check(moviesRes, {
      'movies status is 200': (r) => r.status === 200,
      'movies list has items': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.count > 0;
        } catch (_) {
          return false;
        }
      },
    });
    errorRate.add(!success);

  } else if (rand < 0.90) {
    // ==========================================
    // 3. Recherche & Filtres (30% du trafic)
    // ==========================================
    const randomGenre = GENRES[Math.floor(Math.random() * GENRES.length)];
    const filterRes = http.get(`${BASE_URL}/api/movies?genre=${randomGenre}&minRating=7`);
    const success = check(filterRes, {
      'filter status is 200': (r) => r.status === 200,
    });
    errorRate.add(!success);

  } else {
    // ==========================================
    // 4. Écriture / Création de film (10% du trafic)
    // ==========================================
    const uniqueId = `${Date.now()}-${__VU}-${__ITER}`;
    const payload = JSON.stringify({
      title: `Film Test k6 ${uniqueId}`,
      director: 'k6 Load Tester',
      year: 2026,
      genres: ['Action', 'Sci-Fi'],
      duration: 120,
      ratings: {
        imdb: 8.5,
        rottenTomatoes: 90,
      },
      synopsis: 'Film généré automatiquement pendant le test de charge k6.',
    });

    const params = {
      headers: {
        'Content-Type': 'application/json',
      },
    };

    const postRes = http.post(`${BASE_URL}/api/movies`, payload, params);
    postMovieDuration.add(postRes.timings.duration);

    const success = check(postRes, {
      'create movie status is 201': (r) => r.status === 201,
    });
    errorRate.add(!success);
  }

  // Pause aléatoire entre 0.3s et 1s pour simuler un comportement utilisateur réel
  sleep(Math.random() * 0.7 + 0.3);
}
