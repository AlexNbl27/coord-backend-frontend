# Livrable TRACES.md — CinéSlot

## 1 · L'instrumentation en place

| Maillon | Technologie | Configuration mise en place |
|---|---|---|
| **Back** | Node.js 22 (ESM) + Express + Mongoose | `backend/src/tracing.js` (`@opentelemetry/sdk-node` + hook ESM `@opentelemetry/instrumentation/hook.mjs` chargé via `node --import ./src/tracing.js`), service `cineslot-api`, export OTLP/HTTP vers `http://collector:4318/v1/traces`, échantillonnage `parentbased_always_on`, middleware `X-Trace-Id` dans `backend/src/server.js`. |
| **Collecteur** | `otel/opentelemetry-collector-contrib:0.165.0` | `observabilite/collector.yaml` : récepteur `otlp` HTTP (`0.0.0.0:4318`), processeurs `memory_limiter` (200 MiB) et `attributes/sante` (suppression de `url.query` et `enduser.id`), exportateur `otlp_grpc/jaeger` vers `jaeger:4317` (`tls.insecure: true`) + `debug`. |
| **Front** | Vue 3 + TypeScript + Axios (`adapter: 'fetch'`) | `frontend/src/tracing.ts` (`startTracing()` appelé avant `createApp` dans `frontend/src/main.ts`) : `TracerProvider` (`cineslot-web`), `ParentBasedSampler` (ratio 1), `SanitizingSpanProcessor` (retire `?…` de `url.full`), `BatchSpanProcessor` vers `/otlp/v1/traces`, `StackContextManager`, `W3CTraceContextPropagator`, `FetchInstrumentation` (`ignoreUrls: [/\/otlp\//]`). |
| **Nginx** | Reverse proxy (`frontend/nginx.conf`) | Route `location /otlp/ { proxy_pass http://collector:4318/; client_max_body_size 1m; }` sur la même origine que l'application (aucun CORS nécessaire). |
| **Jaeger** | `jaegertracing/jaeger:2.23.0` | Interface de recherche exposée uniquement sur `127.0.0.1:16686:16686`. |

---

## 2 · Ticket T1 — Lenteur à la confirmation d'une réservation (> 1 s)

- **Recherche Jaeger :** Service `cineslot-api`, opération `POST /api/slots/:id/reservations`, filtre `Min Duration: 1s`.
- **Identifiant de trace :** `9e9f08342e75ec87183a8db9ff579439`
- **Preuve :**
  - Span racine serveur `POST /api/slots/:id/reservations` : **1 263,08 ms**
  - Span métier `cineslot.reservation` : **1 236,72 ms**
  - Requête MongoDB `findOneAndUpdate slots` : **38,13 ms**
  - Span enfant client HTTP `POST` (appel vers `http://sms-passerelle:8090/sms`) : **1 184,31 ms** (93,8 % du temps total).
- **Coupable :** Maillon **service appelé / backend** — appel HTTP synchrone bloquant vers la passerelle SMS dans `reserveSlot` (`backend/src/services/slotService.js`).
- **Piste de correction (équipe Back) :** Rendre l'envoi du SMS de confirmation asynchrone (file de messages / tâche en arrière-plan après l'écriture en base) afin de ne plus bloquer la réponse HTTP de réservation.

---

## 3 · Ticket T2 — Sollicitation excessive de la base sur la liste des séances

- **Recherche Jaeger :** Service `cineslot-api`, opération `GET /api/slots`.
- **Identifiant de trace :** `080b444ded6683fab40784db5e38f107`
- **Preuve :**
  - Durée totale trompeusement faible (**23,42 ms** pour 36 spans), ce qui explique pourquoi le problème ne se voit pas à la durée seule.
  - En comptant les spans enfants sous `request handler - /api/slots`, on observe **11 spans `findOne movies`** suivis de **11 spans `find movies`** exécutés séquentiellement en boucle (problème **N+1**).
- **Coupable :** Maillon **backend / accès MongoDB** — boucle de requêtes `Movie.findOne({ title: slot.movieTitle })` dans `allSlots` (`backend/src/services/slotService.js`).
- **Piste de correction (équipe Back) :** Remplacer les requêtes unitaires dans la boucle par une seule requête groupée (`Movie.find({ title: { $in: titles } })`) avant de mapper les séances.

---

## 4 · Ticket T3 — Erreur intermittente sur l'historique / preuve d'un créneau

- **Recherche Jaeger :** Recherche directe par identifiant (`Lookup by Trace ID`) à partir de l'en-tête `X-Trace-Id` renvoyé par l'API et ajouté au message d'erreur front (`réf. 1f3f32c113c323d6fd4fa1a538e5e947`), ou filtre `error=true` sur `cineslot-api`.
- **Identifiant de trace :** `1f3f32c113c323d6fd4fa1a538e5e947`
- **Preuve :**
  - Span `GET /api/slots/:id/proof` (HTTP **500**) et `request handler - /api/slots/:id/proof` (**4,84 ms**).
  - Événement `exception` attaché au span :
    - `exception.type`: `Error`
    - `exception.message`: `Configuration de salle absente pour le créneau slot-matrix-retro-1`
    - `exception.stacktrace`: `at getSlotProof (file:///app/src/services/slotService.js:287:11)`
- **Coupable :** Maillon **backend** — fonction `getSlotProof` (`backend/src/services/slotService.js:287`), et non le front.
- **Piste de correction (équipe Back) :** Compléter la configuration de salle manquante sur la séance concernée en base et ajouter une valeur de repli / validation à la création de séance.

---

## 5 · Span métier & Données personnelles (RGPD)

Le span métier `cineslot.reservation` dans `backend/src/services/slotService.js` ne porte que des identifiants techniques : `cineslot.slot.id`, `cineslot.reservation.id` et `cineslot.status`. Les paramètres personnels (`customerId`, `visitorId`) et saisies de recherche (`?q=...`) ne sont **jamais** ajoutés aux attributs (et sont nettoyés à la fois dans `SanitizingSpanProcessor` côté navigateur et par `attributes/sante` dans le collecteur).

---

## 6 · Sorties des tests

### Tests unitaires Frontend (`cd frontend && npm test`)
```text
 ✓ src/tests/flows/context.a11y.test.ts (6 tests) 2102ms
 ✓ src/tests/flows/booking.a11y.test.ts (3 tests) 1578ms
 ✓ src/tests/flows/cancel.a11y.test.ts (3 tests) 1989ms
 ✓ src/tests/flows/discovery.a11y.test.ts (3 tests) 1747ms
 ✓ src/tests/flows/dialogs.a11y.test.ts (4 tests) 2063ms
 ✓ src/tests/flows/global.a11y.test.ts (3 tests) 1577ms
 ✓ src/tests/flows/slots.a11y.test.ts (4 tests) 984ms
 ✓ src/tests/tracing.test.ts (3 tests) 1015ms

 Test Files  8 passed (8)
      Tests  29 passed (29)
```

### Script de vérification (`bash tests/verifier_traces.sh`)
```text
=== Verification des traces OpenTelemetry (CineSlot) ===
[OK] Point 1 : Nginx relaie /otlp/v1/traces vers le collecteur (HTTP 200)
[OK] Point 2 : Jaeger recoit les traces de cineslot-api
[OK] Point 3 : propagation traceparent W3C validee dans Jaeger (11256a057e1e3dd80769c3a705f2e8e8)
Bilan : 3 OK, 0 ÉCHEC
```

### Test E2E Playwright (`cd frontend && npx playwright test e2e/trace.spec.ts`)
```text
Running 1 test using 1 worker

  ok 1 e2e\trace.spec.ts:5:1 › une recherche produit une trace front puis back (11.1s)

  1 passed (12.4s)
```
