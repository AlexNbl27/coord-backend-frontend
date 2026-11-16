# Tests de charge k6 — CinéSlot

Ce dossier contient le scénario de montée en charge k6 (`load-test.js`) ciblant l'API Backend (`TARGET_URL`, par défaut `http://backend:3000`).

## Répartition du trafic simulé

- `setup()` : authentification sur `POST /api/session/login` (`spectator-1`) pour récupérer le cookie `cineslot_session`.
- **25 %** : `GET /health`
- **40 %** : `GET /api/movies`
- **20 %** : `GET /api/movies?genre=<genre>&minRating=7`
- **15 %** : `POST /api/movies` suivi de `DELETE /api/movies/:id` (avec cookie de session)
- `teardown()` : suppression des éventuels films `k6 Tester` résiduels.

## Exécution locale

```bash
docker compose --profile test run --rm k6
```

Variables configurables :
- `MAX_VUS` (défaut `500`) : nombre maximal d'utilisateurs virtuels sur les paliers `10 % -> 30 % -> 60 % -> 100 % -> 0 %`.
- `MAX_PING_MS` (défaut `500`) : seuil `p(95)` sur `http_req_duration`.
