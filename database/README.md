# Base de données MongoDB (`database/`)

Ce dossier contient le script d'initialisation de la base de données de cours `cours_db`.

## Initialisation automatique

Lors du lancement de la stack avec `docker compose up -d`, le conteneur MongoDB exécute automatiquement `seed_cinematheque.js` s'il s'agit du premier démarrage (volume vide).

## Réinitialisation manuelle des données

Si vous souhaitez recharger les données de test à tout moment :

```bash
docker compose exec mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin cours_db /docker-entrypoint-initdb.d/seed_cinematheque.js
```

## Authentification et comptes à moindre privilège

MongoDB démarre avec authentification (`MONGO_ROOT_USERNAME` / `MONGO_ROOT_PASSWORD`). Au premier démarrage, `00-init-roles.js` crée trois comptes dans `admin` :

| Compte | Droits |
|---|---|
| `cineslotMaster` | `cineslot_master` (cinemas, users, movies, booking_stats en lecture/écriture ; reservation_logs et audit_logs en insert/find seulement) et `cours_db` tant que la migration multitenant n'est pas faite |
| `cineslotTenant` | collections `slots` et `bookings` des BDD `cinema_<slug>` (y compris leur suppression par la purge J+60), aucun droit sur `cineslot_master` |
| `cineslotPurge` | find/update sur `cineslot_master.cinemas`, insert/find sur les logs, suppression des collections tenant |

Le backend ouvre deux connexions : `MONGO_MASTER_URI` avec `cineslotMaster` (BDD maître et `cours_db` legacy) et `MONGO_TENANT_URI` avec `cineslotTenant` (BDD `cinema_<slug>`). Une faille sur une route cinéma ne donne donc aucun accès à `cineslot_master`. Le job de purge J+60 passe par la connexion tenant, d'où le droit `dropCollection` de `cineslotTenantRole` sur `slots` et `bookings`. `cineslotPurge` reste disponible pour une purge lancée hors du backend.

L'accès append-only aux logs n'est appliqué que sur `cineslot_master`. Le backend garde tous les droits sur `cours_db` tant que la migration multitenant n'est pas faite.

Mongo est sur un réseau Docker `internal` partagé avec le seul backend, et son port n'est plus publié. Pour s'y connecter :

```bash
docker compose exec mongodb mongosh -u "$MONGO_ROOT_USERNAME" -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin
```

Un volume créé avant l'activation de l'authentification n'exécute pas les scripts d'init : `docker compose down -v` puis `docker compose up -d`.
