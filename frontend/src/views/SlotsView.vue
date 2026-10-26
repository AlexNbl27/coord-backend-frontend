<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- En-tête -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div class="flex items-center gap-3">
            <span class="text-3xl">🎬</span>
            <h1 class="text-3xl font-extrabold text-white tracking-tight">Séances de cinéma</h1>
          </div>
          <p class="text-cinema-textMuted text-sm mt-1">
            Réservation instantanée de places avec synchronisation temps réel
          </p>
        </div>

        <!-- Pastille de statut SSE -->
        <div class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-cinema-card border border-cinema-border/60 self-start sm:self-auto text-xs">
          <div
            class="w-2.5 h-2.5 rounded-full transition-all duration-300"
            :class="sseConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-red-500 animate-pulse'"
          ></div>
          <span class="text-cinema-text font-medium">
            {{ sseConnected ? 'Synchronisation active' : 'Hors ligne' }}
          </span>
        </div>
      </div>

      <!-- Barre de Filtres Avancés -->
      <div class="bg-cinema-card/70 p-5 rounded-2xl border border-cinema-border/50 shadow-cinema mb-8 space-y-4">
        <!-- Ligne 1: Recherche & Sélecteur de Film -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Recherche textuelle -->
          <div class="relative">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-cinema-textMuted text-sm">🔍</span>
            <input
              v-model="searchFilter"
              type="text"
              placeholder="Rechercher par film, salle..."
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cinema-darker border border-cinema-border text-cinema-text text-sm focus:border-accent-gold focus:outline-none transition-colors"
            />
            <button
              v-if="searchFilter"
              @click="searchFilter = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cinema-textMuted hover:text-white"
            >
              ✕
            </button>
          </div>

          <!-- Sélecteur de film -->
          <div>
            <select
              v-model="selectedMovieTitle"
              class="w-full px-4 py-2.5 rounded-xl bg-cinema-darker border border-cinema-border text-cinema-text text-sm focus:border-accent-gold focus:outline-none transition-colors"
            >
              <option value="">Tous les films ({{ uniqueMovieTitles.length }})</option>
              <option v-for="title in uniqueMovieTitles" :key="title" :value="title">
                {{ title }}
              </option>
            </select>
          </div>
        </div>

        <!-- Ligne 2: Formats Technologiques & Statut -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-3 border-t border-cinema-border/30">
          <!-- Formats techniques -->
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-xs text-cinema-textMuted mr-1 font-medium">Format :</span>
            <button
              @click="techFilter = 'ALL'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === 'ALL' ? 'bg-accent-gold text-cinema-dark shadow-sm' : 'bg-cinema-darker text-cinema-textMuted hover:text-white border border-cinema-border/50'"
            >
              Tous
            </button>
            <button
              @click="techFilter = 'IMAX'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === 'IMAX' ? 'bg-blue-500 text-white shadow-sm' : 'bg-cinema-darker text-blue-400 hover:text-blue-300 border border-blue-500/30'"
            >
              IMAX Laser
            </button>
            <button
              @click="techFilter = 'Dolby'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === 'Dolby' ? 'bg-purple-500 text-white shadow-sm' : 'bg-cinema-darker text-purple-400 hover:text-purple-300 border border-purple-500/30'"
            >
              Dolby Atmos
            </button>
            <button
              @click="techFilter = '70mm'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === '70mm' ? 'bg-amber-500 text-cinema-dark shadow-sm' : 'bg-cinema-darker text-amber-400 hover:text-amber-300 border border-amber-500/30'"
            >
              70mm Grand Large
            </button>
          </div>

          <!-- Filtre Statut Disponibilité -->
          <div class="flex items-center gap-2 self-start sm:self-auto">
            <button
              @click="selectedFilter = 'ALL'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="selectedFilter === 'ALL' ? 'bg-white/20 text-white' : 'text-cinema-textMuted hover:text-white'"
            >
              Toutes ({{ allSlots.length }})
            </button>
            <button
              @click="selectedFilter = 'AVAILABLE'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="selectedFilter === 'AVAILABLE' ? 'bg-emerald-500 text-cinema-dark shadow-sm' : 'text-emerald-400/80 hover:text-emerald-300'"
            >
              Disponibles ({{ availableSlotsCount }})
            </button>
            <button
              @click="selectedFilter = 'BOOKED'"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="selectedFilter === 'BOOKED' ? 'bg-red-500/80 text-white shadow-sm' : 'text-red-400/80 hover:text-red-300'"
            >
              Complètes ({{ bookedSlotsCount }})
            </button>
          </div>
        </div>
      </div>

      <!-- Résultats : Grille des séances -->
      <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="n in 6" :key="n" class="bg-gray-800 h-44 rounded-xl animate-pulse"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="displayedSlots.length === 0" class="text-center py-16 bg-cinema-card/30 rounded-2xl border border-cinema-border/40 p-8">
        <span class="text-4xl block mb-2">🎟️</span>
        <h3 class="text-lg font-bold text-white mb-1">Aucune séance ne correspond à ces critères</h3>
        <p class="text-xs text-cinema-textMuted max-w-sm mx-auto mb-4">
          Modifiez vos filtres de film, salle ou format pour afficher d'autres créneaux.
        </p>
        <button
          @click="resetFilters"
          class="px-4 py-2 rounded-xl bg-accent-gold text-cinema-dark font-bold text-xs hover:brightness-110 transition-all cursor-pointer"
        >
          Réinitialiser les filtres
        </button>
      </div>

      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <SlotCard
          v-for="slot in displayedSlots"
          :key="slot.id"
          :slot="slot"
          :sse-connected="sseConnected"
          @reserve="handleReserve"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, onMounted, watch } from 'vue';
import { useSlotsStore } from '../stores/slots';
import { useMoviesStore } from '../stores/movies';
import { useSlots } from '../composables/useSlots';
import { useMovies } from '../composables/useMovies';
import { useReservations } from '../composables/useReservations';
import { useAbTest } from '../composables/useAbTest';
import SlotCard from '../components/SlotCard.vue';
import type { Slot } from '../composables/useSlots';

const slotsStore = useSlotsStore();
const moviesStore = useMoviesStore();
const { fetchMovies } = useMovies();
const { fetchSlots, connectSse, reserveSlot, sseConnected } = useSlots();
const { saveBooking } = useReservations();
const { exposeIfAvailable } = useAbTest();

const openReservationModal = inject<(bookingId: string, movieTitle: string, startsAt: string, hall: string) => void>('openReservationModal');

const loading = ref(false);
const selectedFilter = ref<'ALL' | 'AVAILABLE' | 'BOOKED'>('ALL');
const searchFilter = ref('');
const selectedMovieTitle = ref('');
const techFilter = ref<'ALL' | 'IMAX' | 'Dolby' | '70mm'>('ALL');

const allSlots = computed(() => [
  ...slotsStore.availableSlots,
  ...slotsStore.bookedSlots
]);

const availableSlotsCount = computed(() => slotsStore.availableSlots.length);
const bookedSlotsCount = computed(() => slotsStore.bookedSlots.length);

// Liste unique des titres de films ayant des séances
const uniqueMovieTitles = computed(() => {
  const titles = new Set<string>();
  allSlots.value.forEach(s => {
    if (s.movieTitle) titles.add(s.movieTitle);
  });
  return Array.from(titles).sort();
});

const displayedSlots = computed(() => {
  return allSlots.value.filter(slot => {
    // Filtre statut
    if (selectedFilter.value === 'AVAILABLE' && slot.status !== 'AVAILABLE') return false;
    if (selectedFilter.value === 'BOOKED' && slot.status !== 'BOOKED') return false;

    // Filtre film
    if (selectedMovieTitle.value && slot.movieTitle !== selectedMovieTitle.value) return false;

    // Filtre technologie
    if (techFilter.value !== 'ALL') {
      if (!slot.hall || !slot.hall.toLowerCase().includes(techFilter.value.toLowerCase())) {
        return false;
      }
    }

    // Filtre recherche textuelle
    if (searchFilter.value) {
      const q = searchFilter.value.toLowerCase();
      const matchTitle = slot.movieTitle?.toLowerCase().includes(q);
      const matchHall = slot.hall?.toLowerCase().includes(q);
      if (!matchTitle && !matchHall) return false;
    }

    return true;
  });
});

const resetFilters = () => {
  selectedFilter.value = 'ALL';
  searchFilter.value = '';
  selectedMovieTitle.value = '';
  techFilter.value = 'ALL';
};

const handleReserve = async (slotId: string, customerId: string) => {
  try {
    const result = await reserveSlot(slotId, customerId);
    const targetSlot = allSlots.value.find(s => s.id === slotId);
    
    if (targetSlot) {
      const movie = moviesStore.movies.find(m => m.title.toLowerCase() === targetSlot.movieTitle.toLowerCase());
      saveBooking({
        bookingId: result.bookingId,
        slotId: targetSlot.id,
        movieTitle: targetSlot.movieTitle,
        startsAt: targetSlot.startsAt,
        hall: targetSlot.hall,
        poster: movie?.poster
      });

      if (openReservationModal) {
        openReservationModal(
          result.bookingId,
          targetSlot.movieTitle,
          targetSlot.startsAt,
          targetSlot.hall
        );
      }
    }
  } catch (err) {
    console.error('Reservation error:', err);
  }
};

watch(availableSlotsCount, (count) => {
  if (count > 0) {
    exposeIfAvailable(true);
  }
}, { immediate: true });

onMounted(async () => {
  loading.value = true;
  connectSse();
  try {
    await fetchMovies();
    await fetchSlots();
  } catch (err) {
    console.error('Erreur chargement séances:', err);
  } finally {
    loading.value = false;
  }
});
</script>
