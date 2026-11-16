import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';
import { useSession } from './composables/useSession';

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
    path: '/reservations',
    name: 'reservations',
    component: () => import('./views/ReservationsView.vue'),
    meta: {
      title: 'CinéSlot - Mes Réservations',
      description: 'Gérez vos billets et annulez vos réservations',
      requiresAuth: true,
    },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('./views/LoginView.vue'),
    meta: {
      title: 'CinéSlot - Connexion',
      description: 'Connectez-vous ou créez votre compte CinéSlot',
    },
  },
  {
    path: '/reset-password',
    name: 'reset-password',
    component: () => import('./views/ResetPasswordView.vue'),
    meta: {
      title: 'CinéSlot - Nouveau mot de passe',
      description: 'Choisissez un nouveau mot de passe',
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
  scrollBehavior(to: RouteLocationNormalized, from: RouteLocationNormalized, savedPosition) {
    // Toujours faire défiler vers le haut lors de la navigation
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      };
    }
    return { top: 0, behavior: 'smooth' };
  },
});

// Navigation guard pour mettre à jour le titre de la page
router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const { currentUser, initSession } = useSession();
    await initSession();
    if (!currentUser.value) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  }

  const title = (to.meta.title as string) || 'CinéSlot - Réservation de films en temps réel';
  const description = (to.meta.description as string) || 'Découvrez et réservez vos films préférés en temps réel avec synchronisation SSE';
  
  // Mettre à jour le titre de la page
  document.title = title;
  
  // Mettre à jour la meta description (si possible)
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', description);
  }
});

export default router;
