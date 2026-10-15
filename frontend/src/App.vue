<template>
  <div class="min-h-screen bg-cinema-dark">
    <!-- Background gradient subtil -->
    <div class="fixed inset-0 bg-gradient-cinema pointer-events-none"></div>
    
    <!-- NavBar -->
    <Navbar />
    
    <!-- Main Content -->
    <main class="relative z-10 pt-16 min-h-[calc(100vh-4rem)]">
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
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue';
import Navbar from './components/Navbar.vue';
import Footer from './components/Footer.vue';
import ReservationModal from './components/ReservationModal.vue';

// Modal state
const showReservationModal = ref(false);
const currentBookingId = ref('');
const currentMovieTitle = ref('');
const currentStartsAt = ref('');
const currentHall = ref('');

// Function to open reservation modal
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

// Function to close reservation modal
const closeReservationModal = () => {
  showReservationModal.value = false;
};

// Provide modal functions to child components
provide('openReservationModal', openReservationModal);
provide('closeReservationModal', closeReservationModal);
</script>

<style scoped>
/* Animations globales */
.router-view {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
