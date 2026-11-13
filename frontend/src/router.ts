import { createRouter, createWebHistory, type RouteLocationNormalized } from 'vue-router';
import { useSession } from './composables/useSession';
import { currentHostContext, planeRedirect } from './services/tenant';

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
    path: '/choisir-un-cinema',
    redirect: '/cinemas',
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
    path: '/slots/:id/book',
    name: 'slot-booking',
    component: () => import('./views/BookingView.vue'),
    meta: {
      title: 'CinéSlot - Réserver des places',
      description: 'Choisissez vos tarifs et quantités de billets',
      requiresAuth: true,
    },
    props: true,
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
    path: '/admin/logs',
    name: 'admin-logs',
    component: () => import('./views/AdminLogsView.vue'),
    meta: {
      title: 'CinéSlot - Journaux d\'activité',
      description: 'Journaux des réservations et audit des actions d\'administration',
      requiresAuth: true,
      requiresRole: ['SUPER_ADMIN', 'CINEMA_ADMIN'],
    },
  },
  {
    path: '/admin/stats',
    name: 'admin-stats',
    component: () => import('./views/AdminStatsView.vue'),
    meta: {
      title: 'CinéSlot - Statistiques de réservation',
      description: 'Tableau de bord des réservations par cinéma, film et jour',
      requiresAuth: true,
      requiresRole: ['SUPER_ADMIN', 'CINEMA_ADMIN'],
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
    path: '/admin/cinemas',
    name: 'admin-cinemas',
    component: () => import('./views/AdminCinemasView.vue'),
    meta: {
      title: 'CinéSlot - Administration des cinémas',
      description: 'Gestion des cinémas',
      requiresAuth: true,
      requiresRole: ['SUPER_ADMIN'],
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

// Navigation guard pour mettre à jour le titre de la page
router.beforeEach(async (to) => {
  const hostCtx = currentHostContext();
  const redirectName = planeRedirect(hostCtx, to.name as string | undefined);
  if (redirectName === 'not-found') {
    return { name: 'not-found', params: { pathMatch: to.path.slice(1).split('/') }, query: to.query, hash: to.hash, replace: true };
  }
  if (redirectName) {
    return { name: redirectName, replace: true };
  }
  const requiredRoles = to.meta.requiresRole as string[] | undefined;
  if (to.meta.requiresAuth || (requiredRoles && requiredRoles.length > 0)) {
    const { currentUser, mfaVerifiedAt, initSession } = useSession();
    await initSession();
    if (!currentUser.value) {
      return { name: 'login', query: { redirect: to.fullPath } };
    }
    if (requiredRoles && requiredRoles.length > 0) {
      if (!currentUser.value.role || !requiredRoles.includes(currentUser.value.role)) {
        return { name: 'home' };
      }
    }
    if (hostCtx.plane === 'admin' && requiredRoles && requiredRoles.length > 0) {
      const mfaAge = typeof mfaVerifiedAt.value === 'number' ? Date.now() - mfaVerifiedAt.value : Infinity;
      if (mfaAge > 5 * 60 * 1000) {
        return { name: 'login', query: { redirect: to.fullPath, mfa: '1' } };
      }
    }
  }
  const title = (to.meta.title as string) || 'CinéSlot - Réservation de films en temps réel';
  const description = (to.meta.description as string) || 'Découvrez et réservez vos films préférés en temps réel avec synchronisation SSE';

  document.title = title;

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute('content', description);
  }
});

export default router;
