<template>
  <div class="min-h-screen bg-cinema-dark">
    <!-- Skip to main content link pour VoiceOver et clavier -->
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2.5 focus:bg-accent-gold focus:text-cinema-dark focus:font-bold focus:rounded-xl focus:shadow-2xl focus:outline-none focus:ring-2 focus:ring-white"
    >
      Aller au contenu principal
    </a>

    <!-- NavBar -->
    <Navbar />
    
    <!-- Main Content -->
    <main id="main-content" class="relative z-10 pt-16 min-h-[calc(100vh-4rem)]">
      <router-view />
    </main>
    
    <!-- Footer -->
    <Footer />
    
    <!-- Reservation Modal (global) -->
    <ReservationModal
      v-if="showReservationModal"
      :show="showReservationModal"
      :booking-id="currentBookingId"
      :movie-title="currentMovieTitle"
      :starts-at="currentStartsAt"
      :hall="currentHall"
      @close="closeReservationModal"
    />

    <!-- A/B Testing Metrics Modal (global) -->
    <AbMetricsModal
      v-if="showAbMetricsModal"
      :show="showAbMetricsModal"
      @close="showAbMetricsModal = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, provide, onMounted } from 'vue';
import Navbar from './components/Navbar.vue';
import Footer from './components/Footer.vue';
import ReservationModal from './components/ReservationModal.vue';
import AbMetricsModal from './components/AbMetricsModal.vue';
import { useAbTest } from './composables/useAbTest';
import { useSlots } from './composables/useSlots';
import { useConnection } from './composables/useConnection';

const { initAssignment } = useAbTest();
const { connectSse } = useSlots();
const { initConnectionWatcher } = useConnection();

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
  initAssignment();
  connectSse();
});
</script>

<style scoped>
/* Animations globales */
.router-view {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
