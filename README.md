# CinéSlot - Plateforme de Réservation Cinéma

Application full-stack de gestion de catalogue cinématographique et de réservation de séances en temps réel avec Server-Sent Events (SSE), test A/B statistique, génération de billets PDF et traçabilité OpenTelemetry.

## Architecture

- **Frontend (`frontend/`)** : Vue 3, TypeScript, Vite, Pinia, Vue Router, Tailwind CSS, servi en production par Nginx (proxy `/api` et `/otlp/`).
- **Backend (`backend/`)** : Node.js 22 ESM, Express, Mongoose, PDFKit, OpenTelemetry SDK (mode cluster configurable via `WEB_CONCURRENCY`).
- **Base de données (`database/`)** : MongoDB 8.0 avec script d'initialisation (`seed_cinematheque.js`).
- **Observabilité (`observabilite/`)** : Collecteur OpenTelemetry et Jaeger (`127.0.0.1:16686`).
- **Passerelle SMS (`sms-passerelle/`)** : Service HTTP Node.js simulant l'envoi asynchrone de confirmations.
- **Tests de charge (`tests-k6/`)** : Scénarios k6 et workflow GitHub Actions.

## Démarrage rapide (Docker Compose)

```bash
docker compose up -d --build
```

Accès locaux (exposés sur `127.0.0.1`) :
- Choix du cinéma : `http://cineslot.localhost:3001` (`http://localhost:3001` y redirige)
- Un cinéma : `http://<slug>.cineslot.localhost:3001`, par exemple `http://cine-bellecour.cineslot.localhost:3001`
- Administration : `http://admin.cineslot.localhost:3001` (allowlist IP dans `frontend/nginx/admin-allowlist.conf`)
- API Backend : `/api` sur chacun de ces hôtes, via nginx uniquement (le port 3000 n'est plus publié)
- Jaeger UI : `http://127.0.0.1:16686`

## Développement local

### Backend
```bash
cd backend
npm install
npm run dev
npm test
```

### Frontend
```bash
cd frontend
npm install
npm run dev
npm test
npm run build
```

## Endpoints principaux

- `GET /health` et `GET /api/health` : état du service et de la connexion MongoDB.
- `GET /api/movies`, `GET /api/movies/:id`, `POST /api/movies`, `PUT /api/movies/:id`, `DELETE /api/movies/:id` : catalogue de films (mutations protégées par session).
- `GET /api/slots`, `GET /api/slots/events` (SSE), `POST /api/slots/:id/reservations`, `DELETE /api/slots/:id/reservations`, `POST /api/slots/reset`, `POST /api/slots/lab`, `GET /api/slots/:id/proof` : gestion des séances et réservations.
- `GET /api/session`, `POST /api/session/login`, `POST /api/session/logout` : gestion de session spectateur par cookie HTTP-Only signé HMAC-SHA256.
- `GET /api/bookings/:id/ticket.pdf` : génération et téléchargement du billet PDF.
- `GET /api/ab/assignment`, `POST /api/ab/exposure`, `GET /api/ab/metrics`, `POST /api/ab/simulate` : moteur de test A/B.
