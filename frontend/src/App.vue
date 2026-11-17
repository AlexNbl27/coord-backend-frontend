<template>
  <div class="min-h-screen bg-cinema-dark">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-accent-gold focus:text-cinema-dark focus:font-bold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
    >
      Aller au contenu principal
    </a>

    <Navbar />
    
    <main id="main-content" class="relative z-10 pt-16 min-h-[calc(100vh-4rem)]">
      <CinemaStatusBanner />
      <router-view />
    </main>
    
    <Footer />
    
    <ReservationModal
      v-if="showReservationModal"
      :show="showReservationModal"
      :booking-id="currentBookingId"
      :movie-title="currentMovieTitle"
      :starts-at="currentStartsAt"
      :hall="currentHall"
      @close="closeReservationModal"
    />

    <AbMetricsModal
      v-if="showAbMetricsModal"
      :show="showAbMetricsModal"
      @close="showAbMetricsModal = false"
    />
    <div
      v-if="activeToast"
      role="alert"
      aria-live="assertive"
      class="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md flex items-start gap-3 text-xs"
      :class="{
        'bg-red-950/90 border-red-500/40 text-red-200': activeToast.type === 'error',
        'bg-amber-950/90 border-amber-500/40 text-amber-200': activeToast.type === 'warning',
        'bg-emerald-950/90 border-emerald-500/40 text-emerald-200': activeToast.type === 'success',
        'bg-cinema-card/95 border-cinema-border text-cinema-text': activeToast.type === 'info',
      }"
    >
      <p class="flex-1 leading-relaxed">{{ activeToast.message }}</p>
      <button
        type="button"
        @click="clearToast"
        class="text-current opacity-70 hover:opacity-100 cursor-pointer shrink-0 font-bold"
        aria-label="Fermer la notification"
      >
        ✕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue';
import Navbar from './components/Navbar.vue';
import Footer from './components/Footer.vue';
import ReservationModal from './components/ReservationModal.vue';
import AbMetricsModal from './components/AbMetricsModal.vue';
import CinemaStatusBanner from './components/CinemaStatusBanner.vue';
import { useAbTest } from './composables/useAbTest';
import { useSlots } from './composables/useSlots';
import { useConnection } from './composables/useConnection';
import { currentHostContext } from './services/tenant';
import { useCurrentCinema } from './composables/useCurrentCinema';

const { initAssignment } = useAbTest();
const { connectSse } = useSlots();
const { initConnectionWatcher, activeToast, clearToast } = useConnection();
const { loadCurrentCinema } = useCurrentCinema();

const showReservationModal = ref(false);
const currentBookingId = ref('');
const currentMovieTitle = ref('');
const currentStartsAt = ref('');
const currentHall = ref('');

const showAbMetricsModal = ref(false);

const openReservationModal = (
  bookingId: string,
  movieTitle: string,
  startsAt: string,
  hall: string
) => {
  currentBookingId.value = bookingId;
  currentMovieTitle.value = movieTitle;
  currentStartsAt.value = startsAt;
  currentHall.value = hall;
  showReservationModal.value = true;
};

const closeReservationModal = () => {
  showReservationModal.value = false;
};

const openAbMetricsModal = () => {
  showAbMetricsModal.value = true;
};

provide('openReservationModal', openReservationModal);
provide('closeReservationModal', closeReservationModal);
provide('openAbMetricsModal', openAbMetricsModal);

onMounted(() => {
  initConnectionWatcher();
  const { plane } = currentHostContext();
  if (plane !== 'admin') {
    initAssignment();
  }
  if (plane === 'tenant') {
    void loadCurrentCinema();
    connectSse();
  }
});
</script>
