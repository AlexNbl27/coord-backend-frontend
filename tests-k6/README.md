# Tests de charge k6 — CinéSlot

Ce dossier contient le scénario de montée en charge k6 (`load-test.js`) ciblant l'API Backend (`TARGET_URL`, par défaut `http://backend:3000`).

## Scénarios multi-sous-domaines

Le back résout le tenant à partir de l'en-tête `Host`. k6 attaque directement `TARGET_URL` et fixe `Host` à chaque requête :

- `setup()` : connexion admin sur `POST /api/admin/session/login` avec `Host: admin.<K6_ROOT_DOMAIN>`. Le cookie `__Host-cineslot_admin` reçu est renvoyé par les VUs admin. Le compte k6 ne doit pas avoir la TOTP activée.
- **spectators** (montée `10 % -> 30 % -> 60 % -> 100 % -> 0 %` de `MAX_VUS`), `Host: <slug>.<K6_ROOT_DOMAIN>` tiré dans `K6_TENANTS` :
  - **20 %** : `GET /health`
  - **30 %** : `GET /api/slots`
  - **30 %** : `GET /api/movies`
  - **20 %** : `GET /api/movies?genre=<genre>&minRating=7`
- **admins** (2 % de `MAX_VUS`, 80 s), `Host: admin.<K6_ROOT_DOMAIN>` :
  - **50 %** : `GET /api/admin/stats/bookings?groupBy=movie&cinema=<slug>`
  - **50 %** : `POST /api/movies` suivi de `DELETE /api/movies/:id`
- `teardown()` : suppression des éventuels films `k6 Tester` résiduels.

Les cinémas de `K6_TENANTS` doivent exister et être `ACTIVE`, sinon les requêtes tenant échouent (404, 423 ou 410).

## Compte admin

Les mutations utilisent un compte `SUPER_ADMIN` créé par `backend/scripts/create-admin.js` (inclus dans l'image backend) :

```bash
docker compose exec -T backend node scripts/create-admin.js --email "$K6_ADMIN_EMAIL" --name "k6 Admin" --password "$K6_ADMIN_PASSWORD"
```

La CI génère un email et un mot de passe éphémères à chaque run. `run-ci-local.sh` et `run-ci-local.ps1` créent le compte si besoin : sur une base existante, renseignez dans `.env` le mot de passe du compte déjà créé.

## Exécution locale

```bash
docker compose --profile test run --rm k6
```

Variables configurables :
- `MAX_VUS` (défaut `500`) : nombre maximal d'utilisateurs virtuels sur les paliers `10 % -> 30 % -> 60 % -> 100 % -> 0 %`.
- `MAX_PING_MS` (défaut `500`) : seuil `p(95)` sur `http_req_duration`.
- `K6_ROOT_DOMAIN` (défaut `cineslot.localhost:3001`) : domaine racine utilisé dans l'en-tête `Host`.
- `K6_TENANTS` (défaut `cine-bellecour,cine-part-dieu`) : slugs des cinémas ciblés.
- `K6_ADMIN_EMAIL`, `K6_ADMIN_PASSWORD` : compte admin, obligatoires.
