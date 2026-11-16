import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/HomeView.vue'),
    meta: {
      title: 'CinéSlot - Accueil',
      description: 'Découvrez et réservez vos films préférés en temps réel',
    },
  },
  {
    path: '/movies',
    name: 'movies',
    component: () => import('./views/MoviesView.vue'),
    meta: {
      title: 'CinéSlot - Tous les films',
      description: 'Parcourez notre catalogue complet de films',
    },
  },
  {
    path: '/movies/:id',
    name: 'movie-detail',
    component: () => import('./views/MovieDetailView.vue'),
    meta: {
      title: 'CinéSlot - Détails du film',
      description: 'Détails et séances disponibles pour ce film',
    },
    props: true,
  },
  {
    path: '/slots',
    name: 'slots',
    component: () => import('./views/SlotsView.vue'),
    meta: {
      title: 'CinéSlot - Séances disponibles',
      description: 'Toutes les séances de cinéma disponibles',
    },
  },
  {
    path: '/cinemas',
    name: 'cinemas',
    component: () => import('./views/CinemasView.vue'),
    meta: {
      title: 'CinéSlot - Cinémas autour de moi',
      description: 'Trouvez un cinéma à moins de 5 km',
    },
  },
  {
    path: '/reservations',
    name: 'reservations',
    component: () => import('./views/ReservationsView.vue'),
    meta: {
      title: 'CinéSlot - Mes Réservations',
      description: 'Gérez vos billets et annulez vos réservations',
    },
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('./views/AboutView.vue'),
    meta: {
      title: 'CinéSlot - À propos',
      description: 'En savoir plus sur CinéSlot',
    },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('./views/NotFoundView.vue'),
    meta: {
      title: 'CinéSlot - Page non trouvée',
      description: "La page que vous cherchez n'existe pas",
    },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to: RouteLocationNormalized, _from: RouteLocationNormalized, savedPosition) {
    if (savedPosition) {
      return savedPosition;
    }
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      };
    }
    return { top: 0, behavior: 'smooth' };
  },
});

router.beforeEach((to) => {
  const title = (to.meta.title as string) || 'CinéSlot - Réservation de films en temps réel';
  const description = (to.meta.description as string) || 'Découvrez et réservez vos films préférés en temps réel avec synchronisation SSE';

  document.title = title;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', description);
  }
});

export default router;
