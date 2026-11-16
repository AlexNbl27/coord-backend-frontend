# CinéSlot Frontend

Application Vue 3 + TypeScript + Vite pour le catalogue de films et la réservation de séances en temps réel.

## Démarrage

```bash
npm install
npm run dev
```

## Scripts

- `npm run dev` : serveur de développement Vite (`http://localhost:5173`, proxy `/api` vers `http://127.0.0.1:3000`).
- `npm run build` : build de production dans `dist/`.
- `npm test` : suite de tests unitaires et d'accessibilité (`vitest` + `axe-core`).

## Cache & Résilience

- Cache mémoire LRU dans `useMovies.ts` (`15s` TTL) complété par un cache persistant `localStorage` (`10 min` TTL) via `cacheManager.ts`.
- File d'attente hors-ligne (`offlineQueue.ts`) pour les réservations et annulations en cas de coupure réseau.
