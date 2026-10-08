<template>
  <nav class="navbar">
    <div class="page-container">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <router-link to="/" class="flex items-center gap-3">
          <div class="relative">
            <div class="w-10 h-10 bg-gradient-to-br from-accent-gold to-accent-red rounded-xl flex items-center justify-center">
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
        <div class="hidden md:flex items-center gap-8">
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
        </div>

        <!-- Right side: Status + User -->
        <div class="flex items-center gap-4">
          <!-- SSE Status (mini indicator) -->
          <div class="hidden lg:flex items-center gap-2">
            <div
              class="w-2 h-2 rounded-full transition-all duration-300"
              :class="{
                'bg-green-500': sseConnected,
                'bg-red-500 animate-pulse': !sseConnected
              }"
            ></div>
            <span class="text-sm text-cinema-textMuted">
              {{ sseConnected ? 'En ligne' : 'Hors ligne' }}
            </span>
          </div>

          <!-- User / Reservations -->
          <button class="p-2 rounded-full hover:bg-cinema-card transition-colors duration-200">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-cinema-textMuted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </button>

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
      <Transition
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
          </div>
        </div>
      </Transition>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSlotsStore } from '../stores/slots';

const slotsStore = useSlotsStore();
const { sseConnected } = slotsStore;

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
