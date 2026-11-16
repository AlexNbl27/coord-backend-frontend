# Base de données MongoDB (`database/`)

Ce dossier contient le script d'initialisation de la base de données de cours `cours_db`.

## Initialisation automatique

Lors du lancement de la stack avec `docker compose up -d`, le conteneur MongoDB exécute automatiquement `seed_cinematheque.js` s'il s'agit du premier démarrage (volume vide).

## Réinitialisation manuelle des données

Si vous souhaitez recharger les données de test à tout moment :

```bash
docker compose exec mongodb mongosh cours_db /docker-entrypoint-initdb.d/seed_cinematheque.js
```
