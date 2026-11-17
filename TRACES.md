# Traces OpenTelemetry (CinéSlot)

## 1. Instrumentation en place

| Maillon | Technologie | Configuration mise en place |
|---|---|---|
| Back | Node.js 22 (ESM) + Express + Mongoose | `backend/src/tracing.js` (`@opentelemetry/sdk-node`), service `cineslot-api`, export OTLP/HTTP vers `http://collector:4318/v1/traces`, middleware `X-Trace-Id` dans `backend/src/server.js`. |
| Collecteur | `otel/opentelemetry-collector-contrib:0.165.0` | `observabilite/collector.yaml` : récepteur `otlp` HTTP (`0.0.0.0:4318`), processeurs `memory_limiter` (200 MiB) et `attributes/sanitize` (suppression de `url.query`, `enduser.id`, cookies et authorization), exportateur `otlp_grpc/jaeger` vers `jaeger:4317`. |
| Front | Vue 3 + TypeScript + Axios (`adapter: 'fetch'`) | `frontend/src/tracing.ts` (`startTracing()` dans `frontend/src/main.ts`) : `TracerProvider` (`cineslot-web`), `SanitizingSpanProcessor` (retire `?…` de `url.full`), `BatchSpanProcessor` vers `/otlp/v1/traces`, `W3CTraceContextPropagator`, `FetchInstrumentation`. |
| Nginx | Reverse proxy (`frontend/nginx/app-common.conf`) | Route `location /otlp/ { proxy_pass http://collector:4318/; client_max_body_size 256k; }` avec `limit_req zone=otlp_limit`. |
| Jaeger | `jaegertracing/jaeger:2.23.0` | Interface exposée sur `127.0.0.1:16686:16686`. |

## 2. Ticket T1 : lenteur à la confirmation d'une réservation (résolu)

- Trace Jaeger : `cineslot-api`, `POST /api/slots/:id/reservations`, trace `9e9f08342e75ec87183a8db9ff579439` (1 263,08 ms dont 1 184,31 ms sur l'appel HTTP synchrone `sms-passerelle:8090/sms`).
- Origine : appel HTTP bloquant vers la passerelle SMS dans `reserveSlot` (`backend/src/services/slotService.js`).
- Correction appliquée : envoi asynchrone sans blocage de la réponse HTTP via `dispatchSmsConfirmation` dans `backend/src/services/slotService.js`.

## 3. Ticket T2 : requêtes N+1 sur la liste des séances (résolu)

- Trace Jaeger : `cineslot-api`, `GET /api/slots`, trace `080b444ded6683fab40784db5e38f107` (23,42 ms pour 36 spans, dont 11 `findOne movies` + 11 `find movies` en boucle).
- Origine : requêtes unitaires en boucle dans `slotService.js`.
- Correction appliquée : chargement groupé par `$in` (`seedInitialSlotsIfEmpty` / requêtes groupées dans `backend/src/services/slotService.js`).

## 4. Ticket T3 : erreur sur la preuve d'un créneau (résolu)

- Trace Jaeger : `GET /api/slots/:id/proof` (HTTP 500), trace `1f3f32c113c323d6fd4fa1a538e5e947`.
- Origine : configuration de salle manquante dans `getSlotProof` (`backend/src/services/slotService.js`).
- Correction appliquée : ajout d'une valeur de repli `'Salle Principale'` dans `getSlotProof` (`backend/src/services/slotService.js:614-624`).

## 5. Span métier et données personnelles (RGPD)

Le span métier `cineslot.reservation` dans `backend/src/services/slotService.js` ne porte que des identifiants techniques (`cineslot.slot.id`, `cineslot.reservation.id`, `cineslot.status`). Les paramètres personnels et requêtes (`?q=...`, `?lat=...`, `?lon=...`) sont filtrés dans `SanitizingSpanProcessor` côté front et dans `attributes/sanitize` côté collecteur.

## 6. Vérifications

- Tests unitaires frontend : `cd frontend && npm test` (21 fichiers Vitest, tous passants).
- Tests unitaires backend : `NODE_ENV=test node --test test/**/*.test.js` dans `backend/`.
- Script de traces : `bash tests/verifier_traces.sh` (3/3 OK).
- E2E Playwright : `cd frontend && npx playwright test e2e/trace.spec.ts` (1 passed).
