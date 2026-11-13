<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- En-tête -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="font-display text-3xl font-bold text-white tracking-tight">Séances de cinéma</h1>
          </div>
          <p class="text-cinema-textMuted text-sm mt-1">
            Réservation instantanée de places avec synchronisation temps réel
          </p>
        </div>

        <!-- Actions et Pastille de statut SSE -->
        <div class="flex items-center gap-3 self-start sm:self-auto">
          <button
            v-if="isSuperAdmin"
            @click="handleResetSlots"
            class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cinema-card hover:bg-cinema-border/80 border border-cinema-border/60 text-cinema-text hover:text-white text-xs font-semibold transition-all cursor-pointer shadow-sm hover:border-accent-gold/40"
            aria-label="Réinitialiser toutes les séances à l'état disponible"
            title="Remettre toutes les séances à l'état disponible"
          >
            <span>Réinitialiser les séances</span>
          </button>

          <!-- Pastille de statut SSE -->
          <div
            role="status"
            :aria-label="sseConnected ? 'Statut : Synchronisation active en direct' : 'Statut : Hors ligne'"
            class="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-cinema-card border border-cinema-border/60 text-xs"
          >
            <span
              class="w-3 h-3 rounded-full flex items-center justify-center text-[8px] font-black"
              :class="sseConnected ? 'bg-emerald-500 text-cinema-dark' : 'bg-red-500 text-white animate-pulse'"
              aria-hidden="true"
            >
              {{ sseConnected ? '✓' : '!' }}
            </span>
            <span class="text-cinema-text font-medium">
              {{ sseConnected ? 'Synchronisation active' : 'Hors ligne' }}
            </span>
          </div>
        </div>
      </div>

      <!-- Barre de Filtres Avancés -->
      <div class="bg-cinema-card/70 p-5 rounded-2xl border border-cinema-border/50 shadow-cinema mb-8 space-y-4">
        <!-- Ligne 1: Recherche & Sélecteur de Film -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Recherche textuelle -->
          <div class="relative">
            <label for="slots-search-input" class="sr-only">Rechercher par film ou par salle</label>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-cinema-textMuted pointer-events-none" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
            </svg>
            <input
              id="slots-search-input"
              v-model="searchFilter"
              type="search"
              role="searchbox"
              aria-label="Rechercher par film ou par salle"
              placeholder="Rechercher par film, salle..."
              class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cinema-darker border border-cinema-border text-cinema-text text-sm focus:border-accent-gold focus:outline-none transition-colors"
            />
            <button
              v-if="searchFilter"
              @click="searchFilter = ''"
              aria-label="Effacer le filtre de recherche"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-cinema-textMuted hover:text-white"
            >
              ✕
            </button>
          </div>

          <!-- Sélecteur de film -->
          <div>
            <label for="slots-movie-select" class="sr-only">Filtrer par film</label>
            <select
              id="slots-movie-select"
              v-model="selectedMovieTitle"
              aria-label="Filtrer les séances par film"
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
          <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer les séances par format technologique">
            <span class="text-xs text-cinema-textMuted mr-1 font-medium" aria-hidden="true">Format :</span>
            <button
              @click="techFilter = 'ALL'"
              :aria-pressed="techFilter === 'ALL' ? 'true' : 'false'"
              aria-label="Format : Tous les formats technologiques"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === 'ALL' ? 'bg-accent-gold text-cinema-dark shadow-sm' : 'bg-cinema-darker text-cinema-textMuted hover:text-white border border-cinema-border/50'"
            >
              Tous
            </button>
            <button
              @click="techFilter = 'IMAX'"
              :aria-pressed="techFilter === 'IMAX' ? 'true' : 'false'"
              aria-label="Format : Séances IMAX Laser uniquement"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === 'IMAX' ? 'bg-accent-gold text-cinema-dark shadow-sm' : 'bg-cinema-darker text-cinema-textMuted hover:text-white border border-cinema-border/50'"
            >
              IMAX Laser
            </button>
            <button
              @click="techFilter = 'Dolby'"
              :aria-pressed="techFilter === 'Dolby' ? 'true' : 'false'"
              aria-label="Format : Séances Dolby Atmos uniquement"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === 'Dolby' ? 'bg-accent-gold text-cinema-dark shadow-sm' : 'bg-cinema-darker text-cinema-textMuted hover:text-white border border-cinema-border/50'"
            >
              Dolby Atmos
            </button>
            <button
              @click="techFilter = '70mm'"
              :aria-pressed="techFilter === '70mm' ? 'true' : 'false'"
              aria-label="Format : Séances 70mm Grand Large uniquement"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="techFilter === '70mm' ? 'bg-accent-gold text-cinema-dark shadow-sm' : 'bg-cinema-darker text-cinema-textMuted hover:text-white border border-cinema-border/50'"
            >
              70mm Grand Large
            </button>
          </div>

          <!-- Filtre Statut Disponibilité -->
          <div class="flex items-center gap-2 self-start sm:self-auto" role="group" aria-label="Filtrer les séances par disponibilité">
            <button
              @click="selectedFilter = 'ALL'"
              :aria-pressed="selectedFilter === 'ALL' ? 'true' : 'false'"
              aria-label="Disponibilité : Toutes les séances"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="selectedFilter === 'ALL' ? 'bg-white/20 text-white' : 'text-cinema-textMuted hover:text-white'"
            >
              Toutes ({{ allSlots.length }})
            </button>
            <button
              @click="selectedFilter = 'AVAILABLE'"
              :aria-pressed="selectedFilter === 'AVAILABLE' ? 'true' : 'false'"
              aria-label="Disponibilité : Séances disponibles uniquement"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="selectedFilter === 'AVAILABLE' ? 'bg-emerald-500 text-cinema-dark shadow-sm' : 'text-emerald-400/80 hover:text-emerald-300'"
            >
              Disponibles ({{ availableSlotsCount }})
            </button>
            <button
              @click="selectedFilter = 'BOOKED'"
              :aria-pressed="selectedFilter === 'BOOKED' ? 'true' : 'false'"
              aria-label="Disponibilité : Séances complètes uniquement"
              class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer leading-none"
              :class="selectedFilter === 'BOOKED' ? 'bg-red-500/80 text-white shadow-sm' : 'text-red-400/80 hover:text-red-300'"
            >
              Complètes ({{ bookedSlotsCount }})
            </button>
          </div>
        </div>
      </div>

      <!-- Annonce vocale dynamique pour VoiceOver des résultats de filtrage -->
      <div class="sr-only" aria-live="polite" role="status">
        {{ displayedSlots.length }} séance{{ displayedSlots.length > 1 ? 's' : '' }} trouvée{{ displayedSlots.length > 1 ? 's' : '' }}
      </div>

      <div
        v-if="cinemaDisabled"
        role="alert"
        class="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-200"
      >
        Ce cinéma est temporairement désactivé. Les réservations sont suspendues.
      </div>

      <!-- Résultats : Grille des séances -->
      <div v-if="loading && displayedSlots.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="n in 6" :key="n" class="bg-gray-800 h-44 rounded-xl animate-pulse"></div>
      </div>

      <!-- Empty State -->
      <div v-else-if="displayedSlots.length === 0" class="text-center py-16 bg-cinema-card/30 rounded-2xl border border-cinema-border/40 p-8">
        <h2 class="text-lg font-bold text-white mb-1">Aucune séance ne correspond à ces critères</h2>
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

      <div
        v-else
        :class="['grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4', cinemaDisabled ? 'opacity-50 grayscale pointer-events-none select-none' : '']"
        :aria-disabled="cinemaDisabled ? 'true' : undefined"
      >
        <SlotCard
          v-for="slot in displayedSlots"
          :key="slot.id"
          :slot="slot"
          :sse-connected="sseConnected"
          :already-booked="bookedSlotIds.has(slot.id)"
          @reserve="handleReserve"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useSlotsStore } from '../stores/slots';
import { useMoviesStore } from '../stores/movies';
import { useSlots } from '../composables/useSlots';
import { useMovies } from '../composables/useMovies';
import { useReservations } from '../composables/useReservations';
import { useAbTest } from '../composables/useAbTest';
import { useSession } from '../composables/useSession';
import SlotCard from '../components/SlotCard.vue';

const router = useRouter();
const slotsStore = useSlotsStore();
const moviesStore = useMoviesStore();
const { fetchMovies } = useMovies();
const { fetchSlots, connectSse, resetSlots, sseConnected, cinemaDisabled } = useSlots();
const { bookings } = useReservations();
const { exposeIfAvailable } = useAbTest();
const { isSuperAdmin } = useSession();

const bookedSlotIds = computed(() =>
  new Set(
    (bookings?.value ?? [])
      .filter((b) => b.status === 'ACTIVE' || b.status === 'PENDING_SYNC')
      .map((b) => b.slotId)
  )
);

const handleResetSlots = async () => {
  await resetSlots();
};

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

const handleReserve = (slotId: string) => {
  router.push(`/slots/${slotId}/book`);
};

watch(availableSlotsCount, (count) => {
  if (count > 0) {
    exposeIfAvailable(true);
  }
}, { immediate: true });

onMounted(async () => {
  if (displayedSlots.value.length === 0) {
    loading.value = true;
  }
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
