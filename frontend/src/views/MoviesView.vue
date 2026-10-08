<template>
  <div class="min-h-screen">
    <!-- En-tête -->
    <section class="py-12 px-4 sm:px-6 lg:px-8">
      <div class="page-container">
        <h1 class="section-title">🎬 Tous les films</h1>
        <p class="section-subtitle">Parcourez notre catalogue complet de films</p>
        
        <!-- Barre de recherche -->
        <div class="mt-8 max-w-4xl mx-auto">
          <SearchBar
            v-model:search="searchQuery"
            v-model:genre="selectedGenre"
            v-model:minRating="minRating"
            :results-count="filteredMovies.length"
            :available-genres="availableGenres"
            @search="applyFilters"
          />
        </div>
      </div>
    </section>

    <!-- Résultats -->
    <section class="section">
      <div class="page-container">
        <!-- Filtres actifs -->
        <div v-if="hasActiveFilters" class="mb-6 flex flex-wrap gap-2">
          <span v-if="searchQuery" class="badge-genre">
            {{ searchQuery }}
            <button @click="clearSearch" class="ml-1 hover:text-white">×</button>
          </span>
          <span v-if="selectedGenre" class="badge-genre">
            {{ selectedGenre }}
            <button @click="clearGenre" class="ml-1 hover:text-white">×</button>
          </span>
          <span v-if="minRating" class="badge-rating">
            Note ≥ {{ minRating }}
            <button @click="clearRating" class="ml-1 hover:text-white">×</button>
          </span>
          <button @click="resetFilters" class="ml-4 text-cinema-textMuted hover:text-white text-sm">
            Réinitialiser
          </button>
        </div>

        <!-- Grille de films -->
        <div v-if="loading" class="movies-grid">
          <div v-for="n in 12" :key="n" class="skeleton h-80 rounded-xl"></div>
        </div>
        <div v-else-if="filteredMovies.length === 0" class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <p class="empty-state-text">Aucun film trouvé avec ces critères.</p>
          <button @click="resetFilters" class="mt-4 btn btn-primary">
            Réinitialiser les filtres
          </button>
        </div>
        <div v-else class="movies-grid">
          <MovieCard
            v-for="movie in filteredMovies"
            :key="movie._id"
            :movie="movie"
            @click="selectMovie(movie)"
          />
        </div>

        <!-- Pagination -->
        <div v-if="hasMore && filteredMovies.length > 0" class="mt-12 text-center">
          <button
            @click="loadMore"
            class="px-8 py-3 btn btn-primary"
            :disabled="loadingMore"
          >
            <span v-if="!loadingMore">Charger plus</span>
            <span v-else class="flex items-center justify-center gap-2">
              <div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Chargement...
            </span>
          </button>
        </div>
      </div>
    </section>

    <!-- Modal de détails -->
    <Transition name="modal">
      <div v-if="selectedMovie" class="modal-overlay" @click.self="selectedMovie = null">
        <div class="modal-content max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <button @click="selectedMovie = null" class="modal-close">&times;</button>
          
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Affiche -->
            <div class="w-full md:w-1/3">
              <div class="aspect-poster bg-cinema-border rounded-xl overflow-hidden">
                <img
                  v-if="selectedMovie.poster"
                  :src="selectedMovie.poster"
                  :alt="selectedMovie.title"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full bg-gradient-to-br from-cinema-border to-cinema-darker flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-cinema-border/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
            </div>
            
            <!-- Détails -->
            <div class="flex-1">
              <h2 class="text-2xl font-bold text-white mb-2">{{ selectedMovie.title }}</h2>
              
              <div class="flex items-center gap-4 mb-4">
                <div class="flex items-center gap-1">
                  <span class="text-yellow-400 text-xl">★</span>
                  <span class="text-white font-bold">{{ selectedMovie.ratings?.imdb?.toFixed(1) || 'N/A' }}</span>
                </div>
                <span class="text-cinema-textMuted">•</span>
                <span class="text-cinema-textMuted">{{ selectedMovie.year }}</span>
                <span class="text-cinema-textMuted">•</span>
                <span class="text-cinema-textMuted">{{ selectedMovie.duration }} min</span>
              </div>
              
              <p class="text-cinema-textMuted mb-4">
                Réalisé par <span class="text-white">{{ selectedMovie.director || 'Inconnu' }}</span>
              </p>
              
              <div class="flex flex-wrap gap-2 mb-4">
                <span
                  v-for="(genre, index) in selectedMovie.genres"
                  :key="index"
                  class="badge-genre"
                >
                  {{ genre }}
                </span>
              </div>
              
              <!-- Acteurs -->
              <div v-if="selectedMovie.cast && selectedMovie.cast.length > 0" class="mb-4">
                <h3 class="text-sm font-medium text-cinema-textMuted mb-2">Avec</h3>
                <p class="text-sm text-cinema-textMuted">
                  {{ selectedMovie.cast.join(', ') }}
                </p>
              </div>
              
              <p class="text-cinema-textMuted text-sm mb-6">
                {{ selectedMovie.synopsis || 'Aucun synopsis disponible.' }}
              </p>
              
              <!-- Séances pour ce film -->
              <div v-if="slotsByMovie.get(selectedMovie.title)?.length" class="mb-6">
                <h3 class="text-sm font-medium text-cinema-textMuted mb-2">Séances disponibles</h3>
                <div class="space-y-2">
                  <div
                    v-for="slot in slotsByMovie.get(selectedMovie.title)"
                    :key="slot.id"
                    class="flex items-center justify-between p-2 bg-cinema-card/50 rounded-lg"
                  >
                    <div>
                      <p class="text-white text-sm">{{ formatDate(slot.startsAt) }}</p>
                      <p class="text-cinema-textMuted text-xs">{{ slot.hall }}</p>
                    </div>
                    <span
                      class="badge text-xs"
                      :class="{
                        'badge-available': slot.status === 'AVAILABLE',
                        'badge-booked': slot.status === 'BOOKED'
                      }"
                    >
                      {{ slot.status === 'AVAILABLE' ? 'Disponible' : 'Complet' }}
                    </span>
                  </div>
                </div>
              </div>
              
              <!-- Boutons d'action -->
              <div class="flex gap-4">
                <button class="flex-1 btn btn-primary">
                  Réserver
                </button>
                <button @click="selectedMovie = null" class="flex-1 btn btn-outline">
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useMoviesStore } from '../stores/movies';
import { useSlotsStore } from '../stores/slots';
import { useMovies } from '../composables/useMovies';
import SearchBar from '../components/SearchBar.vue';
import MovieCard from '../components/MovieCard.vue';
import type { Movie } from '../composables/useMovies';

const moviesStore = useMoviesStore();
const slotsStore = useSlotsStore();
const { fetchMovies } = useMovies();

// État de recherche
const searchQuery = ref('');
const selectedGenre = ref<string | undefined>();
const minRating = ref<number | undefined>();

// État de chargement
const loading = ref(false);
const loadingMore = ref(false);

// Sélection
const selectedMovie = ref<Movie | null>(null);

// Films calculés
const availableGenres = computed(() => moviesStore.availableGenres);
const filteredMovies = computed(() => moviesStore.filteredMovies);
const hasMore = computed(() => moviesStore.hasMore);
const hasActiveFilters = computed(() => {
  return searchQuery.value || selectedGenre.value || minRating.value;
});

// Séances par film
const slotsByMovie = computed(() => slotsStore.slotsByMovie);

// Appliquer les filtres
const applyFilters = async () => {
  moviesStore.setSearchQuery(searchQuery.value);
  moviesStore.setSelectedGenre(selectedGenre.value);
  moviesStore.setMinRating(minRating.value);
  
  loading.value = true;
  try {
    await fetchMovies({
      search: searchQuery.value,
      genre: selectedGenre.value,
      minRating: minRating.value,
    });
  } catch (err) {
    console.error('Erreur lors de l\'application des filtres:', err);
  } finally {
    loading.value = false;
  }
};

// Charger plus de films
const loadMore = async () => {
  if (loadingMore.value || !hasMore.value) return;
  
  loadingMore.value = true;
  moviesStore.nextPage();
  
  try {
    await fetchMovies({
      search: searchQuery.value,
      genre: selectedGenre.value,
      minRating: minRating.value,
      page: moviesStore.currentPage,
      limit: moviesStore.currentLimit,
    });
  } catch (err) {
    console.error('Erreur lors du chargement de plus de films:', err);
  } finally {
    loadingMore.value = false;
  }
};

// Sélectionner un film
const selectMovie = (movie: Movie) => {
  selectedMovie.value = movie;
  moviesStore.setSelectedMovieTitle(movie.title);
};

// Effacer les filtres
const clearSearch = () => {
  searchQuery.value = '';
  applyFilters();
};

const clearGenre = () => {
  selectedGenre.value = undefined;
  applyFilters();
};

const clearRating = () => {
  minRating.value = undefined;
  applyFilters();
};

const resetFilters = () => {
  searchQuery.value = '';
  selectedGenre.value = undefined;
  minRating.value = undefined;
  moviesStore.resetFilters();
  moviesStore.setPage(1);
  applyFilters();
};

// Formater la date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Charger les données initiales
fetchMovies();
</script>

<style scoped>
/* Animation pour les cartes */
.movie-card {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Skeleton animation */
.skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
