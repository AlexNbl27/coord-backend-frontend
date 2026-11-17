<template>
  <div>
    <section class="relative py-16 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-cinema-border">
      <div class="relative z-10 text-center max-w-4xl mx-auto">
        <p class="text-xs font-mono uppercase tracking-[0.2em] text-accent-gold mb-3">
          Programmation & Billetterie
        </p>

        <h1 class="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight leading-[1.12] mb-5">
          La salle obscure, à l'heure de votre séance.
        </h1>

        <p class="text-base sm:text-lg text-cinema-textMuted max-w-2xl mx-auto mb-8 leading-relaxed">
          Découvrez les plus grands chefs-d'œuvre du cinéma en IMAX & Dolby Atmos. Les disponibilités s'actualisent instantanément sans recharger votre page.
        </p>

        <div class="flex flex-wrap items-center justify-center gap-4">
          <router-link
            to="/slots"
            class="px-7 py-3.5 rounded-md bg-accent-gold hover:bg-accent-goldLight text-cinema-dark font-bold text-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>Réserver une séance</span>
          </router-link>

          <router-link
            to="/movies"
            class="px-7 py-3.5 rounded-md bg-cinema-card hover:bg-cinema-cardHover border border-cinema-border text-white font-semibold text-sm transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span>Explorer le catalogue</span>
          </router-link>
        </div>
      </div>
    </section>

    <section class="py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="font-display text-3xl font-bold text-white mb-2">Films populaires</h2>
            <p class="text-gray-400">Sélection de films culte notés 8.5+</p>
          </div>
          <router-link to="/movies" class="text-sm font-semibold text-accent-gold hover:underline flex items-center gap-1">
            <span>Tous les films</span>
            <span>→</span>
          </router-link>
        </div>
        
        <div v-if="loadingPopular && popularMovies.length === 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <div v-for="n in 4" :key="n" class="bg-cinema-card h-96 rounded-lg animate-pulse"></div>
        </div>
        <div v-else-if="popularMovies.length === 0" class="text-center py-12">
          <p class="text-gray-400">Aucun film populaire à afficher pour le moment.</p>
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <MovieCard
            v-for="movie in popularMovies"
            :key="movie._id"
            :movie="movie"
            @click="selectMovie(movie)"
          />
        </div>
      </div>
    </section>

    <section class="py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-7xl mx-auto">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="font-display text-3xl font-bold text-white mb-2">Séances en temps réel</h2>
            <p class="text-gray-400">Synchronisation SSE instantanée</p>
          </div>
          <router-link to="/slots" class="text-sm font-semibold text-accent-gold hover:underline flex items-center gap-1">
            <span>Toutes les séances</span>
            <span>→</span>
          </router-link>
        </div>

        <div v-if="loadingSlots && availableSlots.length === 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="n in 6" :key="n" class="bg-cinema-card h-40 rounded-lg animate-pulse"></div>
        </div>
        <div v-else-if="availableSlots.length === 0 && !loadingSlots" class="text-center py-12">
          <p class="text-gray-400">Aucune séance disponible.</p>
        </div>
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SlotCard
            v-for="slot in availableSlots"
            :key="slot.id"
            :slot="slot"
            :sse-connected="sseConnected"
            :already-booked="bookedSlotIds.has(slot.id)"
            @reserve="handleReserve"
          />
        </div>
      </div>
    </section>

    <Teleport to="body">
      <transition name="modal">
        <div
          v-if="selectedMovie"
        ref="movieModalRef"
        tabindex="-1"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 focus:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="home-preview-title"
        @click.self="selectedMovie = null"
      >
        <div class="bg-cinema-card border border-cinema-border rounded-2xl p-6 sm:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl focus:outline-none" tabindex="-1">
          <button
            ref="movieModalCloseBtnRef"
            @click="selectedMovie = null"
            class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-cinema-textMuted hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xl"
            aria-label="Fermer la prévisualisation du film"
          >
            <span aria-hidden="true">✕</span>
          </button>
          
          <div class="flex flex-col md:flex-row gap-6">
            <div class="w-full md:w-56 shrink-0">
              <div class="aspect-[2/3] bg-gray-800 rounded-xl overflow-hidden">
                <img
                  v-if="selectedMovie.poster"
                  :src="selectedMovie.poster"
                  :alt="`Affiche de ${selectedMovie.title}`"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full bg-gray-700 flex items-center justify-center" aria-hidden="true">
                  <p class="text-gray-500">Pas d'affiche</p>
                </div>
              </div>
            </div>
            
            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-3 pr-8">
                <div class="min-w-0">
                  <h2 id="home-preview-title" class="text-2xl font-bold text-white">{{ selectedMovie.title }}</h2>
                  <p class="text-gray-400 text-sm mt-0.5">{{ selectedMovie.year }} • {{ selectedMovie.duration }} min • Dir. {{ selectedMovie.director }}</p>
                </div>
                <div class="flex items-center gap-1 bg-accent-gold/15 px-2.5 py-1 rounded-full border border-accent-gold/30 shrink-0">
                  <span class="text-accent-gold text-sm">★</span>
                  <span class="text-white text-xs font-bold">{{ selectedMovie.ratings?.imdb?.toFixed(1) || 'N/A' }}</span>
                </div>
              </div>

              <p class="text-gray-300 text-sm mt-3 mb-4 line-clamp-3 leading-relaxed">{{ selectedMovie.synopsis || 'Aucun synopsis disponible.' }}</p>

              <div class="mb-5 p-3.5 bg-cinema-card/70 rounded-xl border border-cinema-border/50">
                <div class="flex items-center justify-between mb-2.5">
                  <span class="text-xs font-bold uppercase tracking-wider text-accent-gold">
                    <span>Séances programmées ({{ movieSlots.length }})</span>
                  </span>
                  <span v-if="movieSlots.length > 0" class="text-[11px] text-emerald-400 font-medium">Temps réel</span>
                </div>

                <div v-if="movieSlots.length > 0" class="flex flex-wrap gap-2">
                  <button
                    v-for="slot in movieSlots"
                    :key="slot.id"
                    @click="handleReserveFromModal(slot.id)"
                    :disabled="cinemaDisabled"
                    :aria-label="cinemaDisabled ? `Séance de ${formatSlotTime(slot.startsAt)} en salle ${slot.hall}, réservations suspendues` : `Réserver la séance de ${formatSlotTime(slot.startsAt)} en salle ${slot.hall}`"
                    class="disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none group px-3 py-2 rounded-lg bg-cinema-darker hover:bg-accent-gold text-cinema-text hover:text-cinema-dark border border-cinema-border hover:border-accent-gold transition-all text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <span class="font-mono tabular-nums">
                      {{ formatSlotTime(slot.startsAt) }}
                    </span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] bg-white/10 group-hover:bg-black/20 text-cinema-textMuted group-hover:text-cinema-dark">
                      {{ slot.hall }}
                    </span>
                  </button>
                </div>
                <div v-else class="text-xs text-cinema-textMuted py-2 flex items-center justify-between">
                  <span>Aucune séance disponible pour ce film aujourd'hui.</span>
                  <router-link to="/slots" @click="selectedMovie = null" class="text-accent-gold hover:underline font-semibold ml-2">
                    Voir toutes les séances →
                  </router-link>
                </div>
              </div>

              <div class="flex flex-col sm:flex-row gap-2.5">
                <button
                  @click="goToMovieDetail(selectedMovie._id)"
                  :aria-label="`Consulter la fiche complète et le casting du film ${selectedMovie.title}`"
                  class="flex-1 py-2.5 px-4 rounded-xl bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold border border-accent-gold/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Fiche complète & Casting</span>
                  <span aria-hidden="true">→</span>
                </button>
                <button
                  @click="selectedMovie = null"
                  :aria-label="`Fermer la prévisualisation du film ${selectedMovie.title}`"
                  class="py-2.5 px-4 rounded-xl bg-cinema-card hover:bg-cinema-border text-cinema-textMuted hover:text-white text-xs font-medium transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies';
import { useSlotsStore } from '../stores/slots';
import { useMovies } from '../composables/useMovies';
import { useSlots } from '../composables/useSlots';
import { useReservations } from '../composables/useReservations';
import { useAbTest } from '../composables/useAbTest';
import { useAccessibleDialog } from '../composables/useAccessibleDialog';
import MovieCard from '../components/MovieCard.vue';
import SlotCard from '../components/SlotCard.vue';
import type { Movie } from '../composables/useMovies';

const router = useRouter();
const moviesStore = useMoviesStore();
const slotsStore = useSlotsStore();
const { fetchMovies } = useMovies();
const { fetchSlots, connectSse, sseConnected, loading: loadingSlots, cinemaDisabled } = useSlots();
const { bookings } = useReservations();
const { exposeIfAvailable } = useAbTest();

const bookedSlotIds = computed(() =>
  new Set(
    (bookings?.value ?? [])
      .filter((b) => b.status === 'ACTIVE' || b.status === 'PENDING_SYNC')
      .map((b) => b.slotId)
  )
);

const loadingPopular = ref(false);
const selectedMovie = ref<Movie | null>(null);

const movieModalRef = ref<HTMLElement | null>(null);
const movieModalCloseBtnRef = ref<HTMLButtonElement | null>(null);
const isMovieModalOpen = computed(() => selectedMovie.value !== null);

useAccessibleDialog({
  isOpen: isMovieModalOpen,
  dialogRef: movieModalRef,
  initialFocusRef: movieModalCloseBtnRef,
  onClose: () => {
    selectedMovie.value = null;
  },
});

const popularMovies = computed(() => moviesStore.popularMovies);
const availableSlots = computed(() => slotsStore.availableSlots);

watch(availableSlots, (slots) => {
  if (slots.length > 0) {
    exposeIfAvailable(true);
  }
}, { immediate: true });

const movieSlots = computed(() => {
  if (!selectedMovie.value) return [];
  return availableSlots.value.filter(
    s => s.movieTitle.toLowerCase() === selectedMovie.value?.title.toLowerCase()
  );
});

const selectMovie = (movie: Movie) => {
  selectedMovie.value = movie;
};

const formatSlotTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris',
    });
  } catch {
    return dateStr;
  }
};

const goToMovieDetail = (movieId: string) => {
  selectedMovie.value = null;
  router.push(`/movies/${movieId}`);
};

const handleReserveFromModal = (slotId: string) => {
  selectedMovie.value = null;
  router.push(`/slots/${slotId}/book`);
};

const handleReserve = (slotId: string) => {
  router.push(`/slots/${slotId}/book`);
};

onMounted(async () => {
  if (popularMovies.value.length === 0) {
    loadingPopular.value = true;
  }
  connectSse();
  try {
    await fetchMovies();
    await fetchSlots();
  } catch (err) {
    console.error('Error loading data:', err);
  } finally {
    loadingPopular.value = false;
  }
});
</script>
