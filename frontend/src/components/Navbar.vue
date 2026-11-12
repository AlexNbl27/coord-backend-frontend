<template>
  <header class="navbar">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Navigation principale">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-3" aria-label="CinéSlot - Accueil">
          <div class="w-9 h-9 bg-cinema-card border border-accent-gold/60 rounded flex items-center justify-center" aria-hidden="true">
            <span class="font-display text-base font-bold text-accent-gold tracking-tight">CS</span>
          </div>
          <div class="hidden sm:flex flex-col">
            <span class="font-display text-xl font-bold text-cinema-text tracking-tight">CinéSlot</span>
            <span class="text-xs text-cinema-textMuted -mt-1">{{ isAdminPlane ? 'Portail admin' : 'Réservation en temps réel' }}</span>
          </div>
        </router-link>

        <!-- Navigation Links -->
        <div class="hidden md:flex items-center gap-5 lg:gap-7">
          <template v-for="link in navLinks" :key="link.label">
            <a v-if="link.href" :href="link.href" class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium whitespace-nowrap">{{ link.label }}</a>
            <router-link v-else :to="link.to!" class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium whitespace-nowrap" active-class="text-accent-gold font-semibold">
              {{ link.label }}
            </router-link>
          </template>
        </div>

        <!-- Right side: Status + User Tickets -->
        <div class="flex items-center gap-3">
          <!-- Indicateur de Connexion & Résilience -->
          <ConnectionBadge class="hidden sm:inline-flex" />

          <!-- Session spectateur -->
          <div v-if="currentUser" class="hidden lg:flex items-center gap-2">
            <span class="text-cinema-text text-xs font-medium truncate max-w-[10rem]">{{ currentUser.name }}</span>
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-full bg-cinema-card border border-cinema-border text-cinema-textMuted hover:text-cinema-text text-xs font-medium cursor-pointer whitespace-nowrap"
              @click="handleLogout"
            >
              Se déconnecter
            </button>
          </div>
          <router-link
            v-else
            to="/login"
            class="hidden lg:inline-block px-2.5 py-1.5 rounded-full bg-cinema-card border border-cinema-border text-cinema-text text-xs font-medium hover:border-accent-gold/50"
          >
            Se connecter
          </router-link>

          <!-- User / Mes Billets Quick Action Button -->
          <router-link
            v-if="!isAdminPlane"
            to="/reservations"
            class="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cinema-card hover:bg-cinema-border/80 border border-cinema-border text-cinema-text text-xs font-semibold transition-all hover:border-accent-gold/50 shadow-sm"
            aria-label="Mes Billets de cinéma"
            title="Consulter mes billets"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <span class="hidden sm:inline">Mes Billets</span>
            <span
              v-if="activeBookingsCount > 0"
              class="px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-accent-gold text-cinema-dark ml-0.5"
            >
              {{ activeBookingsCount }}
            </span>
          </router-link>

          <!-- Bouton Test A/B -->
          <button
            v-if="isSuperAdmin && !isAdminPlane"
            @click="handleOpenAbModal"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent-gold/10 hover:bg-accent-gold/20 border border-accent-gold/40 text-accent-gold text-xs font-bold transition-all shadow-sm cursor-pointer"
            aria-label="Consulter les métriques du Test A/B"
            title="Consulter les métriques du Test A/B"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-accent-gold" aria-hidden="true"></span>
            <span class="hidden sm:inline">Test A/B :</span>
            <span>{{ variant }}</span>
          </button>

          <!-- Mobile menu button -->
          <button
            @click="toggleMobileMenu"
            :aria-expanded="mobileMenuOpen ? 'true' : 'false'"
            aria-controls="mobile-nav-panel"
            aria-label="Menu principal de navigation"
            class="md:hidden p-2 rounded-full hover:bg-cinema-card transition-colors duration-200 cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-cinema-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16m-7 6h7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Mobile Menu -->
      <transition
        enter-active-class="transition-all duration-300 ease-out"
        leave-active-class="transition-all duration-200 ease-in"
        enter-from-class="opacity-0 scale-95 -translate-y-2"
        leave-to-class="opacity-0 scale-95 -translate-y-2"
      >
        <div
          v-if="mobileMenuOpen"
          id="mobile-nav-panel"
          class="md:hidden pb-4"
          role="region"
          aria-label="Menu mobile"
        >
          <div class="flex flex-col gap-3 pt-4 border-t border-cinema-border/50">
            <template v-for="link in navLinks" :key="link.label">
              <a v-if="link.href" :href="link.href" class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2">{{ link.label }}</a>
              <router-link
                v-else
                :to="link.to!"
                class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2"
                active-class="text-accent-gold font-semibold"
                @click="mobileMenuOpen = false"
              >
                {{ link.label }}
              </router-link>
            </template>
            <div class="pt-3 border-t border-cinema-border/30 flex items-center justify-between gap-2">
              <template v-if="currentUser">
                <span class="text-xs text-cinema-text truncate">{{ currentUser.name }}</span>
                <button
                  type="button"
                  @click="() => { handleLogout(); mobileMenuOpen = false; }"
                  class="px-3 py-1.5 rounded-lg bg-cinema-card border border-cinema-border text-cinema-text text-xs font-medium hover:border-accent-gold/50 cursor-pointer shrink-0"
                >
                  Se déconnecter
                </button>
              </template>
              <router-link
                v-else
                to="/login"
                @click="mobileMenuOpen = false"
                class="w-full text-center px-3 py-2 rounded-lg bg-cinema-card border border-cinema-border text-cinema-text text-xs font-medium hover:border-accent-gold/50"
              >
                Se connecter
              </router-link>
            </div>
            <router-link
              v-if="!isAdminPlane"
              to="/reservations"
              class="text-accent-gold hover:text-white transition-colors duration-200 font-medium py-2 flex items-center justify-between border-t border-cinema-border/30 pt-3"
              active-class="text-accent-gold font-bold"
              @click="mobileMenuOpen = false"
            >
              <span class="flex items-center gap-2">
                <span>Mes Billets</span>
              </span>
              <span
                v-if="activeBookingsCount > 0"
                class="px-2 py-0.5 text-xs font-bold rounded-full bg-accent-gold text-cinema-dark"
              >
                {{ activeBookingsCount }}
              </span>
            </router-link>
            <button
              v-if="currentUser"
              type="button"
              class="text-left text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2 cursor-pointer"
              @click="mobileMenuOpen = false; handleLogout()"
            >
              Se déconnecter ({{ currentUser.name }})
            </button>
            <router-link
              v-else
              to="/login"
              class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2"
              @click="mobileMenuOpen = false"
            >
              Se connecter
            </router-link>
          </div>
        </div>
      </transition>
    </nav>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject } from 'vue';
import { storeToRefs } from 'pinia';
import ConnectionBadge from './ConnectionBadge.vue';
import { useSlotsStore } from '../stores/slots';
import { useReservations } from '../composables/useReservations';
import { useAbTest } from '../composables/useAbTest';
import { useRouter } from 'vue-router';
import { useSession } from '../composables/useSession';
import { apexUrl, currentHostContext } from '../services/tenant';

const slotsStore = useSlotsStore();
const { sseConnected } = storeToRefs(slotsStore);
const { activeBookingsCount } = useReservations();
const { variant } = useAbTest();
const { currentUser, isSuperAdmin, initSession, logout } = useSession();
const router = useRouter();
const hostContext = currentHostContext();
const chooseCinemaHref = apexUrl('/choisir-un-cinema');
const isAdminPlane = hostContext.plane === 'admin';

type NavLink = { label: string; to?: string; href?: string };
// The admin portal only serves admin pages (planeRedirect sends the public ones to /admin/cinemas).
const navLinks = computed<NavLink[]>(() => (isAdminPlane
  ? [
      { label: 'Cinémas', to: '/admin/cinemas' },
      { label: 'Journaux', to: '/admin/logs' },
      { label: 'Statistiques', to: '/admin/stats' },
    ]
  : [
      { label: 'Accueil', to: '/' },
      { label: 'Films', to: '/movies' },
      { label: 'Séances', to: '/slots' },
      hostContext.plane === 'tenant' ? { label: 'Cinémas', href: chooseCinemaHref } : { label: 'Cinémas', to: '/cinemas' },
      { label: 'À propos', to: '/about' },
    ]));

const handleLogout = async () => {
  await logout();
  if (router.currentRoute.value.meta.requiresAuth) {
    await router.push('/');
  }
};

const openAbMetricsModal = inject<() => void>('openAbMetricsModal');

const handleOpenAbModal = () => {
  if (openAbMetricsModal) {
    openAbMetricsModal();
  }
};

const mobileMenuOpen = ref(false);

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value;
};

onMounted(() => {
  void initSession();
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.navbar') && !target.closest('[data-mobile-menu]')) {
      mobileMenuOpen.value = false;
    }
  });
});
</script>

<style scoped>
.navbar {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}
</style>
