<template>
  <nav class="navbar">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-3">
          <div class="relative">
            <div class="w-10 h-10 bg-gradient-to-br from-accent-gold to-accent-red rounded-xl flex items-center justify-center shadow-md">
              <span class="text-xl font-black text-cinema-dark">C</span>
            </div>
            <div class="absolute -top-1 -right-1 w-4 h-4 bg-accent-gold rounded-full border-2 border-cinema-dark flex items-center justify-center">
              <span class="text-[10px] font-bold text-cinema-dark">S</span>
            </div>
          </div>
          <div class="hidden sm:flex flex-col">
            <span class="text-xl font-bold text-cinema-text">CinéSlot</span>
            <span class="text-xs text-cinema-textMuted -mt-1">Réservation en temps réel</span>
          </div>
        </router-link>

        <!-- Navigation Links -->
        <div class="hidden md:flex items-center gap-7">
          <router-link
            to="/"
            class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium"
            active-class="text-accent-gold font-semibold"
          >
            Accueil
          </router-link>
          <router-link
            to="/movies"
            class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium"
            active-class="text-accent-gold font-semibold"
          >
            Films
          </router-link>
          <router-link
            to="/slots"
            class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium"
            active-class="text-accent-gold font-semibold"
          >
            Séances
          </router-link>
          <router-link
            to="/about"
            class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium"
            active-class="text-accent-gold font-semibold"
          >
            À propos
          </router-link>
        </div>

        <!-- Right side: Status + User Tickets -->
        <div class="flex items-center gap-3">
          <!-- SSE Status (mini indicator) -->
          <div class="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-cinema-card/70 border border-cinema-border/40">
            <div
              class="w-2 h-2 rounded-full transition-all duration-300"
              :class="{
                'bg-green-500 shadow-sm shadow-green-500/50': sseConnected,
                'bg-red-500 animate-pulse': !sseConnected
              }"
            ></div>
            <span class="text-xs text-cinema-textMuted">
              {{ sseConnected ? 'Synchronisé' : 'Hors ligne' }}
            </span>
          </div>

          <!-- User / Mes Billets Quick Action Button -->
          <router-link
            to="/reservations"
            class="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cinema-card hover:bg-cinema-border/80 border border-cinema-border text-cinema-text text-xs font-semibold transition-all hover:border-accent-gold/50 shadow-sm"
            title="Consulter mes billets"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-accent-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

          <!-- Mobile menu button -->
          <button
            @click="toggleMobileMenu"
            class="md:hidden p-2 rounded-full hover:bg-cinema-card transition-colors duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-cinema-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <div v-if="mobileMenuOpen" class="md:hidden pb-4">
          <div class="flex flex-col gap-3 pt-4 border-t border-cinema-border/50">
            <router-link
              to="/"
              class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2"
              active-class="text-accent-gold font-semibold"
              @click="mobileMenuOpen = false"
            >
              Accueil
            </router-link>
            <router-link
              to="/movies"
              class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2"
              active-class="text-accent-gold font-semibold"
              @click="mobileMenuOpen = false"
            >
              Films
            </router-link>
            <router-link
              to="/slots"
              class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2"
              active-class="text-accent-gold font-semibold"
              @click="mobileMenuOpen = false"
            >
              Séances
            </router-link>
            <router-link
              to="/about"
              class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 font-medium py-2"
              active-class="text-accent-gold font-semibold"
              @click="mobileMenuOpen = false"
            >
              À propos
            </router-link>
            <router-link
              to="/reservations"
              class="text-accent-gold hover:text-white transition-colors duration-200 font-medium py-2 flex items-center justify-between border-t border-cinema-border/30 pt-3"
              active-class="text-accent-gold font-bold"
              @click="mobileMenuOpen = false"
            >
              <span class="flex items-center gap-2">
                <span>🎫</span>
                <span>Mes Billets</span>
              </span>
              <span
                v-if="activeBookingsCount > 0"
                class="px-2 py-0.5 text-xs font-bold rounded-full bg-accent-gold text-cinema-dark"
              >
                {{ activeBookingsCount }}
              </span>
            </router-link>
          </div>
        </div>
      </transition>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useSlotsStore } from '../stores/slots';
import { useReservations } from '../composables/useReservations';

const slotsStore = useSlotsStore();
const { sseConnected } = storeToRefs(slotsStore);
const { activeBookingsCount } = useReservations();

const mobileMenuOpen = ref(false);

const toggleMobileMenu = () => {
  mobileMenuOpen.value = !mobileMenuOpen.value;
};

// Fermer le menu mobile lorsqu'on clique à l'extérieur
const closeMobileMenu = () => {
  mobileMenuOpen.value = false;
};

onMounted(() => {
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

/* Animation pour le logo */
.navbar .w-10 {
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-2px) rotate(5deg);
  }
}

/* Animation pour le badge S */
.navbar .w-4 {
  animation: pulse-slow 2s ease-in-out infinite;
}
</style>
