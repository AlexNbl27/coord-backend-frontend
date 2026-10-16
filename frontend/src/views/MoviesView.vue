<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- En-tête standardisé -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div class="flex items-center gap-3">
            <span class="text-3xl">🎬</span>
            <h1 class="text-3xl font-extrabold text-white tracking-tight">Catalogue des films</h1>
          </div>
          <p class="text-cinema-textMuted text-sm mt-1">
            Explorez notre sélection de chefs-d'œuvre cinématographiques et réservez votre séance
          </p>
        </div>

        <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cinema-card border border-cinema-border/60 text-xs text-cinema-textMuted self-start sm:self-auto">
          <span class="text-accent-gold font-bold">{{ sortedMovies.length }}</span>
          <span>film{{ sortedMovies.length > 1 ? 's' : '' }} à l'affiche</span>
        </div>
      </div>

      <!-- Barre de recherche -->
      <div class="mb-6">
        <SearchBar
          v-model:search="searchQuery"
          v-model:genre="selectedGenre"
          v-model:minRating="selectedMinRating"
          :availableGenres="availableGenres"
          :resultsCount="sortedMovies.length"
          @search="onSearch"
          :minSearchLength="3"
          :debounceDelay="300"
        />
      </div>

      <!-- Filtres actifs & Barre de tri (alignement vertical harmonisé) -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-4 border-b border-cinema-border/40">
        <!-- Chips filtres actifs -->
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-cinema-textMuted font-medium">Filtres :</span>
          <span v-if="!hasActiveFilters" class="text-xs text-cinema-textMuted/70 italic">Aucun filtre actif</span>
          
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-accent-gold/15 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/25 transition-colors cursor-pointer"
          >
            <span>"{{ searchQuery }}"</span>
            <span class="font-bold">✕</span>
          </button>

          <button
            v-if="selectedGenre"
            @click="selectedGenre = ''"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-accent-gold/15 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/25 transition-colors cursor-pointer"
          >
            <span>Genre: {{ selectedGenre }}</span>
            <span class="font-bold">✕</span>
          </button>

          <button
            v-if="selectedMinRating"
            @click="selectedMinRating = undefined"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-accent-gold/15 text-accent-gold border border-accent-gold/30 hover:bg-accent-gold/25 transition-colors cursor-pointer"
          >
            <span>Note ≥ {{ selectedMinRating }}★</span>
            <span class="font-bold">✕</span>
          </button>

          <button
            v-if="hasActiveFilters"
            @click="resetAllFilters"
            class="text-xs text-cinema-textMuted hover:text-white underline ml-2 cursor-pointer"
          >
            Tout effacer
          </button>
        </div>

        <!-- Sélecteur de tri -->
        <div class="flex items-center gap-2.5 self-start sm:self-auto">
          <label class="text-xs text-cinema-textMuted font-medium whitespace-nowrap">Trier par :</label>
          <select
            v-model="currentSort"
            class="h-9 px-3 rounded-lg bg-cinema-card border border-cinema-border text-cinema-text text-xs focus:ring-1 focus:ring-accent-gold focus:outline-none transition-colors"
          >
            <option value="rating_desc">Note IMDB (décroissante)</option>
            <option value="year_desc">Année (plus récents)</option>
            <option value="title_asc">Titre (A → Z)</option>
            <option value="duration_desc">Durée (plus longs)</option>
          </select>
        </div>
      </div>

      <!-- Résultats : Grille de films -->
      <div v-if="loading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div v-for="n in 8" :key="n" class="bg-gray-800 h-96 rounded-xl animate-pulse"></div>
      </div>
      <div v-else-if="sortedMovies.length === 0" class="text-center py-16 bg-cinema-card/30 rounded-2xl border border-cinema-border/40">
        <span class="text-4xl block mb-2">🎬</span>
        <h3 class="text-lg font-bold text-white mb-1">Aucun film ne correspond à votre recherche</h3>
        <p class="text-xs text-cinema-textMuted max-w-sm mx-auto mb-4">
          Essayez d'ajuster vos critères de recherche ou réinitialisez les filtres.
        </p>
        <button
          @click="resetAllFilters"
          class="px-4 py-2 rounded-xl bg-accent-gold text-cinema-dark font-bold text-xs hover:brightness-110 transition-all cursor-pointer"
        >
          Réinitialiser la recherche
        </button>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <MovieCard
          v-for="movie in sortedMovies"
          :key="movie._id"
          :movie="movie"
          @click="selectMovie(movie)"
        />
      </div>
    </div>

    <!-- Modal de détails enrichie -->
    <transition name="modal">
      <div v-if="selectedMovie" class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" @click.self="selectedMovie = null">
        <div class="bg-cinema-card border border-cinema-border rounded-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
          <button
            @click="selectedMovie = null"
            class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-cinema-textMuted hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xl"
            aria-label="Fermer"
          >
            ✕
          </button>
          
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Affiche -->
            <div class="w-full md:w-1/3">
              <div class="aspect-[2/3] bg-cinema-darker rounded-xl overflow-hidden border border-cinema-border/50">
                <img
                  v-if="selectedMovie.poster"
                  :src="selectedMovie.poster"
                  :alt="selectedMovie.title"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 text-sm">
                  Pas d'affiche
                </div>
              </div>
            </div>
            
            <!-- Détails -->
            <div class="flex-1">
              <div class="flex items-start justify-between">
                <div>
                  <h2 class="text-2xl font-bold text-white">{{ selectedMovie.title }}</h2>
                  <p class="text-gray-400 text-xs mt-0.5">{{ selectedMovie.year }} • {{ selectedMovie.duration }} min • Dir. {{ selectedMovie.director }}</p>
                </div>
                <div class="flex items-center gap-1 bg-accent-gold/15 px-2.5 py-1 rounded-full border border-accent-gold/30">
                  <span class="text-accent-gold text-sm">★</span>
                  <span class="text-white text-xs font-bold">{{ selectedMovie.ratings?.imdb?.toFixed(1) || 'N/A' }}</span>
                </div>
              </div>

              <!-- Genres -->
              <div class="flex flex-wrap gap-1.5 mt-3">
                <span
                  v-for="(genre, index) in selectedMovie.genres"
                  :key="index"
                  class="text-[11px] px-2 py-0.5 rounded bg-white/10 text-gray-300 font-medium"
                >
                  {{ genre }}
                </span>
              </div>

              <p class="text-gray-300 text-sm mt-3 mb-4 line-clamp-3 leading-relaxed">
                {{ selectedMovie.synopsis || 'Aucun synopsis disponible.' }}
              </p>
              
              <!-- Séances disponibles pour ce film -->
              <div class="mb-5 p-3.5 bg-cinema-darker/70 rounded-xl border border-cinema-border/50">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-xs font-bold uppercase tracking-wider text-accent-gold flex items-center gap-1.5">
                    <span>🎟️</span>
                    <span>Séances programmées ({{ movieSlots.length }})</span>
                  </span>
                  <span v-if="movieSlots.length > 0" class="text-[10px] text-emerald-400 font-medium">Temps réel</span>
                </div>

                <div v-if="movieSlots.length > 0" class="flex flex-wrap gap-2">
                  <button
                    v-for="slot in movieSlots"
                    :key="slot.id"
                    @click="handleReserveFromModal(slot.id)"
                    class="group px-3 py-2 rounded-lg bg-cinema-card hover:bg-accent-gold text-cinema-text hover:text-cinema-dark border border-cinema-border hover:border-accent-gold transition-all text-xs font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <span>🕒 {{ formatSlotTime(slot.startsAt) }}</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] bg-white/10 group-hover:bg-black/20 text-cinema-textMuted group-hover:text-cinema-dark">
                      {{ slot.hall }}
                    </span>
                  </button>
                </div>
                <div v-else class="text-xs text-cinema-textMuted py-2 flex items-center justify-between">
                  <span>Aucune séance disponible pour ce film aujourd'hui.</span>
                  <router-link to="/slots" @click="selectedMovie = null" class="text-accent-gold hover:underline font-semibold ml-2">
                    Voir les séances →
                  </router-link>
                </div>
              </div>

              <!-- Actions -->
              <div class="flex flex-col sm:flex-row gap-2.5">
                <button
                  @click="goToMovieDetails(selectedMovie)"
                  class="flex-1 py-2.5 px-4 rounded-xl bg-accent-gold/15 hover:bg-accent-gold/25 text-accent-gold border border-accent-gold/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Fiche complète & Casting</span>
                  <span>→</span>
                </button>
                <button
                  @click="selectedMovie = null"
                  class="py-2.5 px-4 rounded-xl bg-cinema-darker hover:bg-cinema-border text-cinema-textMuted hover:text-white text-xs font-medium transition-all cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useMoviesStore } from '../stores/movies';
import { useSlotsStore } from '../stores/slots';
import { useMovies } from '../composables/useMovies';
import { useSlots } from '../composables/useSlots';
import { useReservations } from '../composables/useReservations';
import MovieCard from '../components/MovieCard.vue';
import SearchBar from '../components/SearchBar.vue';
import type { Movie } from '../composables/useMovies';

const router = useRouter();
const moviesStore = useMoviesStore();
const slotsStore = useSlotsStore();
const { fetchMovies } = useMovies();
const { fetchSlots, connectSse, reserveSlot } = useSlots();
const { saveBooking } = useReservations();

const openReservationModal = inject<(bookingId: string, movieTitle: string, startsAt: string, hall: string) => void>('openReservationModal');

const loading = ref(false);
const selectedMovie = ref<Movie | null>(null);
const currentSort = ref<'rating_desc' | 'year_desc' | 'title_asc' | 'duration_desc'>('rating_desc');

// État local pour les filtres
const searchQuery = ref('');
const selectedGenre = ref<string | undefined>(undefined);
const selectedMinRating = ref<number | undefined>(undefined);

const availableGenres = computed(() => moviesStore.availableGenres);

const hasActiveFilters = computed(() => {
  return Boolean(searchQuery.value || selectedGenre.value || selectedMinRating.value);
});

const movieSlots = computed(() => {
  if (!selectedMovie.value) return [];
  return slotsStore.availableSlots.filter(
    s => s.movieTitle.toLowerCase() === selectedMovie.value?.title.toLowerCase()
  );
});

const sortedMovies = computed(() => {
  const list = [...moviesStore.filteredMovies];
  switch (currentSort.value) {
    case 'rating_desc':
      return list.sort((a, b) => (b.ratings?.imdb || 0) - (a.ratings?.imdb || 0));
    case 'year_desc':
      return list.sort((a, b) => b.year - a.year);
    case 'title_asc':
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case 'duration_desc':
      return list.sort((a, b) => b.duration - a.duration);
    default:
      return list;
  }
});

const selectMovie = (movie: Movie) => {
  selectedMovie.value = movie;
};

const goToMovieDetails = (movie: Movie | null) => {
  if (!movie) return;
  selectedMovie.value = null;
  router.push(`/movies/${movie._id}`);
};

const formatSlotTime = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const resetAllFilters = () => {
  searchQuery.value = '';
  selectedGenre.value = undefined;
  selectedMinRating.value = undefined;
  onSearch();
};

const handleReserveFromModal = async (slotId: string) => {
  selectedMovie.value = null;
  const customerId = `user-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
  try {
    const result = await reserveSlot(slotId, customerId);
    const slot = slotsStore.availableSlots.find(s => s.id === slotId);
    if (slot) {
      const movie = moviesStore.movies.find(m => m.title.toLowerCase() === slot.movieTitle.toLowerCase());
      saveBooking({
        bookingId: result.bookingId,
        slotId: slot.id,
        movieTitle: slot.movieTitle,
        startsAt: slot.startsAt,
        hall: slot.hall,
        poster: movie?.poster
      });

      if (openReservationModal) {
        openReservationModal(result.bookingId, slot.movieTitle, slot.startsAt, slot.hall);
      }
    }
  } catch (err) {
    console.error('Reservation error:', err);
  }
};

// Gérer la recherche à partir de la SearchBar
const onSearch = () => {
  moviesStore.setSearchQuery(searchQuery.value);
  moviesStore.setSelectedGenre(selectedGenre.value);
  moviesStore.setMinRating(selectedMinRating.value);
  loadMovies();
};

// Charger les films avec les filtres
const loadMovies = async () => {
  loading.value = true;
  try {
    const filters = {
      search: searchQuery.value || undefined,
      genre: selectedGenre.value || undefined,
      minRating: selectedMinRating.value || undefined,
      page: 1,
      limit: 50,
    };
    await fetchMovies(filters, true);
  } catch (err) {
    console.error('Error loading movies:', err);
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  connectSse();
  await loadMovies();
  await fetchSlots();
});
</script>
