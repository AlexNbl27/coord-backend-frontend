# CinéSlot Frontend

Application Vue 3 + Vite + TypeScript pour la plateforme de réservation de films CinéSlot.

## Démarrage rapide

### Développement

```bash
# Installer les dépendances
npm install

# Démarrer le serveur de développement (port 5173)
npm run dev

# Le frontend sera accessible sur http://localhost:5173
```

### Production

```bash
# Build pour la production
npm run build

# Servir les fichiers statiques
npx serve -s dist -l 3001

# Ou avec Docker
docker build -t cineslot-frontend .
docker run -p 3001:80 cineslot-frontend
```

## Structure du projet

```
frontend/
├── public/           # Fichiers statiques
├── src/
│   ├── assets/       # Styles, images, polices
│   ├── components/   # Composants Vue réutilisables
│   ├── composables/  # Composables (useMovies, useSlots)
│   ├── stores/       # Stores Pinia
│   ├── views/        # Pages Vue
│   ├── App.vue       # Composant racine
│   ├── main.ts       # Point d'entrée
│   ├── router.ts     # Configuration Vue Router
│   ├── vite.config.ts # Configuration Vite
│   └── ...
├── Dockerfile        # Build de production
├── Dockerfile.dev    # Build de développement
├── nginx.conf        # Configuration Nginx
└── .dockerignore
```

## Configuration

### Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```env
VITE_API_MOVIES_URL=http://localhost:3000/api/movies
VITE_API_SLOTS_URL=http://localhost:8086/api/slots
VITE_SSE_EVENTS_URL=http://localhost:8086/api/slots/events
```

### Proxy Vite

Le fichier `vite.config.ts` est préconfiguré pour proxyfier les requêtes API vers les backends en développement.

## Fonctionnalités

- **Recherche et filtrage** des films par titre, genre, note minimale
- **Affichage détaillé** des films avec affiches, synopsis, casting
- **Réservation en temps réel** avec synchronisation SSE
- **Notifications instantanées** lorsque des places sont réservées
- **Design dark mode** inspiré des plateformes cinéma premium
- **Responsive** pour tous les appareils

## API Backend

- **API Films**: http://localhost:3000/api/movies
- **Service SSE**: http://localhost:8086/api/slots
- **Flux SSE**: http://localhost:8086/api/slots/events

## Technologies

- **Framework**: Vue 3
- **Build Tool**: Vite 5
- **Language**: TypeScript
- **State Management**: Pinia
- **Routing**: Vue Router
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Container**: Docker + Nginx

## Bonnes pratiques

- Composants réutilisables dans `src/components/`
- Logique métier dans `src/composables/`
- État global dans `src/stores/`
- Types TypeScript pour toutes les interfaces API
- Design responsive avec Tailwind CSS

## Thème Cinéma

Le design utilise une palette de couleurs dark mode avec :
- Fond sombre (`bg-cinema-dark`)
- Textes clairs (`text-cinema-text`)
- Accents dorés (`accent-gold`)
- Cartes avec bordures subtiles (`bg-cinema-card`)

## Points de terminaison API

### Films
- `GET /api/movies` - Liste des films avec filtres et pagination
- `GET /api/movies/:id` - Détails d'un film
- `POST /api/movies` - Créer un film
- `PUT /api/movies/:id` - Mettre à jour un film
- `DELETE /api/movies/:id` - Supprimer un film

### Séances (Slots)
- `GET /api/slots` - Liste des séances
- `POST /api/slots/:id/reservations` - Réserver une place
- `GET /api/slots/events` - Flux SSE pour les mises à jour en temps réel

##  Sécurité

- Toutes les requêtes API passent par Axios avec gestion des erreurs
- Connexion SSE sécurisée avec reconnexion automatique
- Validation des données côté frontend et backend

## Performance

- Cache des requêtes API (5 secondes TTL)
- Lazy loading des composants Vue
- Code splitting avec Vite
- Optimisation des images et assets
