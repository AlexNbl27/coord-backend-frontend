# 🎬 CinéSlot - Coordination Backend & Frontend

**Plateforme complète de gestion cinéma avec recherche de films, réservation de séances en temps réel et tests de charge.**

Projet académique YNOV - Module Coordination Backend & Frontend.

---

## 🏗️ Architecture

```
coord-backend-frontend/
├── backend/                             # API REST Node.js/Express (Port 3000)
│   ├── Dockerfile                       # Build Node.js 22
│   ├── package.json                    # Dépendances Express + Mongoose
│   └── src/
│       ├── server.js                    # Cluster + MongoDB + CORS
│       ├── models/Movie.js              # Schéma Mongoose + index B-Tree
│       └── routes/movieRoutes.js        # CRUD + Cache TTL 5s
│
├── services/
│   └── cineslot-sse/                    # Service SSE Spring Boot (Port 8086)
│       ├── Dockerfile                   # Build Spring Boot
│       ├── compose.yaml                 # Config MongoDB locale
│       ├── pom.xml                      # Maven + Spring Boot 3.5.6
│       └── src/main/java/fr/medislot/    # Contrôleurs REST + SSE
│
├── frontend/                            # Application Vue 3 + Vite (Port 5173)
│   ├── index.html                      # Entrée HTML
│   ├── package.json                    # Dépendances Vite + Vue + Pinia
│   ├── vite.config.ts                  # Proxy vers APIs backend
│   ├── tailwind.config.js              # Thème cinéma dark-mode
│   └── src/
│       ├── main.ts                     # Initialisation Vue + Pinia + Router
│       ├── App.vue                     # Layout principal
│       ├── router.ts                  # Vue Router
│       ├── style.css                  # Styles globaux + animations
│       ├── components/                # Composants réutilisables
│       │   ├── Navbar.vue              # Barre de navigation
│       │   ├── MovieCard.vue           # Carte film avec infos
│       │   ├── SlotCard.vue            # Carte séance avec SSE
│       │   ├── SearchBar.vue           # Recherche + filtres
│       │   ├── SseStatus.vue           # Indicateur connexion SSE
│       │   └── ReservationModal.vue    # Modal confirmation réservation
│       ├── composables/               # Logique métier
│       │   ├── useMovies.ts            # Appels API films
│       │   └── useSlots.ts             # Appels API séances + SSE
│       ├── stores/                    # State management (Pinia)
│       │   ├── movies.ts               # Store films
│       │   └── slots.ts                # Store séances
│       └── views/                     # Pages
│           ├── HomeView.vue           # Accueil (populaires, récents, séances)
│           ├── MoviesView.vue          # Liste complète des films
│           ├── SlotsView.vue           # Liste des séances
│           ├── AboutView.vue           # À propos
│           └── NotFoundView.vue        # 404
│
├── database/                            # Données MongoDB
│   └── seed_movies.js                   # 12 films + index composites
│
├── tests-k6/                            # Tests de charge Grafana k6
│   ├── load-test.js                     # Scénarios avec paliers dynamiques
│   ├── run-ci-local.ps1                 # Script Windows
│   └── run-ci-local.sh                  # Script Linux
│
├── docker-compose.yml                  # Orchestration complète
├── .env.example                        # Template variables d'environnement
├── .gitignore                          # Exclusions Git
└── README.md                           # Documentation
```

---

## 🚀 Démarrage Rapide

### Prérequis

- **Docker & Docker Compose** (v20.10+)
- **Node.js** 20+ (optionnel pour le développement frontend local)
- **Java** 21+ (optionnel pour builder le service SSE localement)

### 1. Lancer la stack complète avec Docker

```bash
# Depuis la racine du projet
docker compose up -d --build
```

**Services disponibles :**

| Service | URL | Port | Description |
|---------|-----|------|-------------|
| API Films | http://localhost:3000 | 3000 | Backend Node.js + Express |
| Santé API | http://localhost:3000/health | - | Vérification statut |
| Billetterie SSE | http://localhost:8086 | 8086 | Service Spring Boot |
| SSE Events | http://localhost:8086/api/slots/events | - | Flux Server-Sent Events |
| Frontend | http://localhost:5173 | 5173 | Application Vue 3 |
| MongoDB | localhost:27017 | 27017 | Base de données |
| k6 Dashboard | http://localhost:5665 | 5665 | Tests de charge (profil test) |

### 2. Lancer uniquement les backends (sans frontend)

```bash
docker compose up -d mongodb backend cineslot-sse
```

### 3. Développer le frontend localement (avec hot-reload)

```bash
cd frontend
npm install
npm run dev
```

Le frontend sera accessible sur http://localhost:5173 avec proxy vers les APIs backend.

### 4. Builder le frontend pour la production

```bash
cd frontend
npm run build
```

---

## 📡 Endpoints API

### API Films (Node.js / Express)

| Méthode | Endpoint | Description | Exemple |
|---------|----------|-------------|---------|
| GET | `/health` | Statut API + MongoDB | `curl http://localhost:3000/health` |
| GET | `/api/movies` | Liste films | `?genre=Sci-Fi&minRating=8.5` |
| GET | `/api/movies/:id` | Détail d'un film | `GET /api/movies/60d5ec9f8b3e4b0015f1b2a1` |
| POST | `/api/movies` | Créer un film | Body JSON complet |
| PUT | `/api/movies/:id` | Mettre à jour | Body JSON partiel |
| DELETE | `/api/movies/:id` | Supprimer | - |

**Paramètres de filtrage :**
- `search` : Recherche textuelle (sur titre, réalisateur, genres, tags)
- `genre` : Filtrer par genre (ex: `Sci-Fi`)
- `minRating` : Note IMDB minimale (ex: `8.5`)
- `director` : Filtrer par réalisateur
- `page` : Numéro de page (défaut: 1)
- `limit` : Nombre de résultats par page (défaut: 20, max: 100)

### Service Billetterie SSE (Spring Boot)

| Méthode | Endpoint | Description | Exemple |
|---------|----------|-------------|---------|
| GET | `/api/slots` | Liste des séances | - |
| POST | `/api/slots/{id}/reservations` | Réserver une place | Body: `{"customerId": "user-123"}` |
| GET | `/api/slots/events` | Flux SSE temps réel | `new EventSource(url)` |
| POST | `/api/lab/slots` | Générer une séance de démo | - |

**Format d'une séance :**
```json
{
  "id": "abc123",
  "startsAt": "2026-10-08T20:00:00Z",
  "status": "AVAILABLE",
  "version": 1,
  "movieTitle": "Inception",
  "hall": "Salle 1 · IMAX Laser"
}
```

**Événements SSE :**
- `ready` : Connexion établie → `{"action": "reload"}`
- `slot-updated` : Séance mise à jour → `{"slotId": "...", "status": "BOOKED", "version": 2}`
- `:keepalive` : Heartbeat toutes les 15s

---

## 🎨 Frontend - Fonctionnalités

### ✅ Recherche et exploration de films

- **Recherche textuelle dynamique** : Filtre instantané sur titre, réalisateur, genres, tags
- **Filtres par genre** : Sélection multiple avec suggestions
- **Filtres par note minimale** : 7+, 8+, 8.5+, 9+
- **Pagination infinie** : Chargement automatique au scroll
- **Affichage optimisé** : Cartes avec affiches, notes, durée, réalisateur

### ✅ Réservation de séances en temps réel

- **Connexion SSE native** : `new EventSource('/api/slots/events')`
- **Synchronisation instantanée** : Mise à jour de l'UI dès qu'une réservation est effectuée (par vous ou un autre client)
- **Modal de confirmation** : Affichage de l'ID de réservation, du film, de la séance et de la salle
- **Indicateur de connexion** : Badge visuel en bas à droite de l'écran

### ✅ Design et expérience utilisateur

- **Thème cinéma dark-mode** : Inspiré Letterboxd, Pathé, Netflix
- **Palettes de couleurs** : Noir profond (#0a0a0a), Doré (#d4af37), Rouge cinéma (#b91c1c)
- **Animations fluides** : Hover sur les cartes, transitions, effets de glow
- **Responsive design** : Adapté mobile, tablette, desktop
- **Accessibilité** : Focus visibles, contrastes élevés

---

## 🔧 Configuration

### Variables d'environnement

Créer un fichier `.env` à la racine :

```env
# Ports
MONGO_PORT=27017
BACKEND_PORT=3000
SSE_PORT=8086
FRONTEND_PORT=5173

# Tests de charge k6
MAX_VUS=500
MAX_PING_MS=500

# Backend Node.js
PORT=3000
MONGO_URI=mongodb://mongodb:27017/cours_db?directConnection=true
TARGET_URL=http://backend:3000
WEB_CONCURRENCY=2

# Service SSE (si lancé séparément)
SPRING_DATA_MONGODB_URI=mongodb://mongodb:27017/cours_db
SPRING_PROFILES_ACTIVE=lab
```

### Clustering Node.js

Le backend utilise automatiquement tous les cœurs disponibles :

```env
# Nombre de workers Node.js (défaut: nombre de cœurs)
WEB_CONCURRENCY=4
```

---

## 🧪 Tests & CI/CD

### 1. Exécuter les tests de charge locaux

```bash
# Avec dashboard web (http://localhost:5665)
docker compose --profile test up -d

# En mode CI (sans interface)
docker compose run --rm k6-ci
```

### 2. Scripts de simulation locale

**Windows (PowerShell)** :
```powershell
./tests-k6/run-ci-local.ps1 -MaxVus 200 -MaxPingMs 400
```

**Linux/macOS/Bash** :
```bash
./tests-k6/run-ci-local.sh 200 400
```

### 3. Workflow CI GitHub

- **Déclenchement** : Push/PR sur `main`, `master`, `develop`
- **Action** : Lance MongoDB + Backend → Attend health → Exécute k6 avec paliers (10%, 30%, 60%, 100%)
- **Alerte** : Ouvre un ticket GitHub si p(95) > `MAX_PING_MS` (défaut: 500ms)
- **Cible** : 50 VUs par défaut en CI (adapté aux runners 2 vCPUs)

### Scénarios k6

- **Palier 1** : 10% de MAX_VUS (warmup)
- **Palier 2** : 30% de MAX_VUS (charge nominale)
- **Palier 3** : 60% de MAX_VUS (forte affluence)
- **Palier 4** : 100% de MAX_VUS (point de rupture)
- **Seuils** : p(95) < MAX_PING_MS, p(99) < 1200ms, rate < 1%

---

## 📦 Technologies

| Composant | Technologie | Version | Description |
|-----------|-------------|---------|-------------|
| **Frontend** | Vue 3 | 3.5.x | Framework JavaScript réactif |
| | Vite | 5.4.x | Bundler ultra-rapide |
| | TypeScript | 5.6.x | Typage statique |
| | Pinia | 2.2.x | State management |
| | Vue Router | 4.4.x | Routing |
| | Tailwind CSS | 3.4.x | Framework CSS utilitaire |
| | Axios | 1.7.x | Client HTTP |
| **Backend Films** | Node.js | 20.x | Runtime JavaScript |
| | Express | 4.21.x | Framework web |
| | Mongoose | 8.7.x | ODM MongoDB |
| **Backend SSE** | Spring Boot | 3.5.6 | Framework Java |
| | Java | 21 | JDK LTS |
| | Spring Data MongoDB | - | Connexion MongoDB |
| **Base de données** | MongoDB | 8.0 | Base NoSQL |
| **Tests** | Grafana k6 | latest | Tests de charge |
| **DevOps** | Docker | 29.x | Conteneurisation |
| | Docker Compose | 3.8 | Orchestration |
| | GitHub Actions | - | CI/CD |

---

## 📁 Structure du Frontend

```
frontend/
├── index.html                          # Point d'entrée HTML
├── package.json                        # Dépendances npm
├── vite.config.ts                      # Configuration Vite + Proxy
├── tailwind.config.js                  # Thème Tailwind personnalisé
├── postcss.config.js                   # Configuration PostCSS
└── src/
    ├── main.ts                         # Initialisation Vue
    ├── App.vue                         # Composant racine
    ├── router.ts                       # Configuration Vue Router
    ├── vite-env.d.ts                    # Types Vite
    ├── style.css                       # Styles globaux + animations
    ├── components/                     # Composants réutilisables
    │   ├── Navbar.vue                  # Barre de navigation
    │   ├── MovieCard.vue               # Carte film
    │   ├── SlotCard.vue                # Carte séance
    │   ├── SearchBar.vue               # Barre de recherche
    │   ├── SseStatus.vue               # Indicateur SSE
    │   └── ReservationModal.vue        # Modal de confirmation
    ├── composables/                    # Logique métier
    │   ├── useMovies.ts                # Gestion des films
    │   └── useSlots.ts                 # Gestion des séances + SSE
    ├── stores/                         # State management (Pinia)
    │   ├── movies.ts                   # Store films
    │   └── slots.ts                    # Store séances
    └── views/                          # Pages
        ├── HomeView.vue               # Accueil
        ├── MoviesView.vue             # Liste films
        ├── MovieDetailView.vue         # Détails film (à implémenter)
        ├── SlotsView.vue               # Liste séances
        ├── AboutView.vue               # À propos
        └── NotFoundView.vue            # 404
```

---

## 🎯 Cas d'usage

### 1. Découvrir les films

```
GET /api/movies?genre=Sci-Fi&minRating=8.5&search=Nolan
```

→ Retourne les films de science-fiction avec note ≥ 8.5 réalisé par Christopher Nolan

### 2. Réserver une séance

```
# 1. Lister les séances disponibles
GET /api/slots

# 2. Se connecter au flux SSE
const eventSource = new EventSource('http://localhost:8086/api/slots/events');

eventSource.addEventListener('slot-updated', (event) => {
  const { slotId, status, version } = JSON.parse(event.data);
  // Mettre à jour l'UI
});

# 3. Réserver une place
POST /api/slots/{slotId}/reservations
{
  "customerId": "user-abc123"
}
```

### 3. Générer une séance de démonstration

```
POST /api/lab/slots
```

→ Crée une nouvelle séance aléatoire avec un film du catalogue

---

## 🛑 Arrêter la stack

```bash
# Arrêter tous les conteneurs
docker compose down

# Arrêter et supprimer les volumes (⚠️ supprime les données)
docker compose down -v
```

---

## 📝 Journal des changements

### 2026-10-08

- ✅ **Phase 1** : Nettoyage du dépôt - Renommage du service SSE
- ✅ **Phase 3** : Orchestration Docker - Ajout de tous les services
- ✅ **Phase 2** : Frontend - Application Vue 3 complète avec SSE
- ✅ Mise à jour de la documentation

### Fonctionnalités implémentées

- Recherche de films avec filtres dynamiques
- Connexion SSE native avec gestion des événements
- Réservation de séances avec confirmation instantanée
- Design cinéma dark-mode responsive
- Synchronisation temps réel entre clients
- Tests de charge k6 avec workflow CI GitHub

---

## 📄 Licences

- **Backend Node.js** : MIT
- **Service SSE Spring Boot** : Apache 2.0
- **Frontend** : MIT
- **Tests k6** : Apache 2.0

---

## 🙏 Remerciements

- **YNOV** : École d'ingénierie numérique
- **Vite** : [https://vitejs.dev](https://vitejs.dev)
- **Vue.js** : [https://vuejs.org](https://vuejs.org)
- **Spring Boot** : [https://spring.io/projects/spring-boot](https://spring.io/projects/spring-boot)
- **Grafana k6** : [https://k6.io](https://k6.io)
- **Tailwind CSS** : [https://tailwindcss.com](https://tailwindcss.com)
