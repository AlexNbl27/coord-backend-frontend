# Projet YNOV - Coordination Backend & Frontend

Projet complet comprenant :
- **Backend** : API REST CRUD développée avec Node.js, Express et Mongoose.
- **Base de données** : MongoDB avec pré-remplissage automatique des données (films & utilisateurs).
- **Tests de performance** : Scénarios de charge Grafana **k6** avec **Web Dashboard** temps réel.
- **Frontend** : Dossier réservé pour l'application cliente (React, Vue, etc.).

---

## 📁 Structure du dépôt

```text
coord-backend-frontend/
├── docker-compose.yml       # Orchestre MongoDB, le Backend et les tests k6
├── .env.example             # Modèle de variables d'environnement
├── README.md                # Documentation principale
│
├── backend/                 # API REST Node.js / Express
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js        # Point d'entrée serveur
│       ├── models/Movie.js  # Schéma Mongoose
│       └── routes/movieRoutes.js # Routes CRUD (/api/movies)
│
├── database/                # Scripts MongoDB
│   └── seed_movies.js       # Dataset cinéma (12 films avec sous-documents et index)
│
├── tests-k6/                # Tests de charge
│   └── load-test.js         # Scénario k6 avec seuils de qualité
│
└── frontend/                # Emplacement pour le futur frontend
```

---

## 🚀 Démarrage rapide

### 1. Lancer la stack (MongoDB + Backend)

Depuis la racine du projet :

```bash
docker compose up -d --build
```

- **API Backend** : [http://localhost:3000](http://localhost:3000)
- **Vérification de santé** : [http://localhost:3000/health](http://localhost:3000/health)
- **MongoDB** : accessible sur `localhost:27017` (base `cours_db`)

---

## 📡 Endpoints de l'API Backend

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/health` | Statut de l'API et de la connexion MongoDB |
| `GET` | `/api/movies` | Récupère tous les films (filtres : `?genre=Sci-Fi`, `?minRating=8.5`) |
| `GET` | `/api/movies/:id` | Récupère un film par son `_id` |
| `POST` | `/api/movies` | Ajoute un nouveau film |
| `PUT` | `/api/movies/:id` | Modifie un film |
| `DELETE`| `/api/movies/:id` | Supprime un film |

---

## ⚡ Exécuter les tests de charge k6 avec Interface Web

Pour lancer le test de charge et visualiser les métriques en direct :

```bash
docker compose run --rm -p 5665:5665 k6
```

Puis ouvrez votre navigateur sur :
👉 **[http://localhost:5665](http://localhost:5665)**

Vous observerez en direct :
- Le débit de requêtes par seconde
- Les centiles de temps de réponse (p90, p95)
- Les vérifications (*checks*) et seuils de qualité (*thresholds*)

---

## 🛑 Arrêter la stack

```bash
docker compose down
```
*(Pour effacer également les volumes de données : `docker compose down -v`)*
