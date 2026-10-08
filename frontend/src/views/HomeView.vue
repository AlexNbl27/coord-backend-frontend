<template>
  <div class="min-h-screen">
    <!-- Hero Section -->
    <section class="relative py-16 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <!-- Background -->
      <div class="absolute inset-0 bg-gradient-to-br from-cinema-dark via-cinema-darker to-cinema-dark"></div>
      <div class="absolute inset-0 opacity-10">
        <div class="absolute top-0 left-0 w-96 h-96 bg-accent-gold rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        <div class="absolute bottom-0 right-0 w-96 h-96 bg-accent-red rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
      </div>
      
      <!-- Content -->
      <div class="relative z-10 text-center">
        <h1 class="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-4">
          Découvrez vos films <span class="text-gradient">préférés</span>
        </h1>
        <p class="text-lg sm:text-xl text-cinema-textMuted max-w-3xl mx-auto mb-8">
          Réservez des places en temps réel avec synchronisation instantanée entre tous les appareils.
        </p>
        
        <!-- Barre de recherche -->
        <div class="max-w-2xl mx-auto">
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

    <!-- Section Films populaires -->
    <section class="section">
      <div class="page-container">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="section-title">🎬 Films populaires</h2>
            <p class="section-subtitle">Note IMDB >= 8.5</p>
          </div>
          <router-link
            to="/movies"
            class="text-accent-gold hover:text-accent-gold/80 transition-colors duration-200 font-medium"
          >
            Voir tous →
          </router-link>
        </div>
        
        <!-- Grille de films populaires -->
        <div v-if="loadingPopular" class="movies-grid">
          <div v-for="n in 6" :key="n" class="skeleton h-80 rounded-xl"></div>
        </div>
        <div v-else class="movies-grid">
          <MovieCard
            v-for="movie in popularMovies"
            :key="movie._id"
            :movie="movie"
            @click="selectMovie(movie)"
          />
        </div>
      </div>
    </section>

    <!-- Section Films récents -->
    <section class="section bg-cinema-darker/50">
      <div class="page-container">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="section-title">🎥 Nouveautés</h2>
            <p class="section-subtitle">Sorties récentes</p>
          </div>
        </div>
        
        <!-- Grille de films récents -->
        <div v-if="loadingRecent" class="movies-grid">
          <div v-for="n in 6" :key="n" class="skeleton h-80 rounded-xl"></div>
        </div>
        <div v-else class="movies-grid">
          <MovieCard
            v-for="movie in recentMovies"
            :key="movie._id"
            :movie="movie"
            @click="selectMovie(movie)"
          />
        </div>
      </div>
    </section>

    <!-- Section Séances disponibles -->
    <section class="section">
      <div class="page-container">
        <div class="flex items-center justify-between mb-8">
          <div>
            <h2 class="section-title">🎟️ Séances disponibles</h2>
            <p class="section-subtitle">Réservez en temps réel avec synchronisation SSE</p>
          </div>
          <button
            @click="generateDemoSlot"
            class="btn btn-primary"
            :disabled="!sseConnected"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
            </svg>
            Nouvelle séance
          </button>
        </div>

        <!-- Indicateur de statut SSE -->
        <div v-if="!sseConnected" class="mb-6 p-4 bg-red-900/20 border border-red-600/30 rounded-lg text-red-400">
          <p class="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
            </svg>
            Connexion SSE en cours... Les séances seront chargées automatiquement.
          </p>
        </div>

        <!-- Grille de séances -->
        <div v-if="loadingSlots" class="slots-grid">
          <div v-for="n in 6" :key="n" class="skeleton h-40 rounded-lg"></div>
        </div>
        <div v-else-if="availableSlots.length === 0 && !loadingSlots" class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <p class="empty-state-text">Aucune séance disponible pour le moment.</p>
          <p class="empty-state-text mt-2">Appuyez sur "Nouvelle séance" pour en créer une.</p>
        </div>
        <div v-else class="slots-grid">
          <SlotCard
            v-for="slot in availableSlots"
            :key="slot.id"
            :slot="slot"
            :sse-connected="sseConnected"
            @reserve="handleReserve"
            @click="selectSlot(slot)"
          />
        </div>
      </div>
    </section>

    <!-- Modal de détails de film -->
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
              
              <p class="text-cinema-textMuted text-sm mb-6">
                {{ selectedMovie.synopsis || 'Aucun synopsis disponible.' }}
              </p>
              
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
import { ref, computed, onMounted, inject } from 'vue';
import { useMoviesStore } from '../stores/movies';
import { useSlotsStore } from '../stores/slots';
import { useMovies } from '../composables/useMovies';
import { useSlots } from '../composables/useSlots';
import SearchBar from '../components/SearchBar.vue';
import MovieCard from '../components/MovieCard.vue';
import SlotCard from '../components/SlotCard.vue';
import type { Movie } from '../composables/useMovies';
import type { Slot } from '../composables/useSlots';

const moviesStore = useMoviesStore();
const slotsStore = useSlotsStore();
const { fetchMovies, searchMovies, filterByGenre, filterByRating } = useMovies();
const { fetchSlots, reserveSlot, generateDemoSlot, sseConnected, availableSlots, loading: loadingSlots } = useSlots();

// État de recherche
const searchQuery = ref('');
const selectedGenre = ref<string | undefined>();
const minRating = ref<number | undefined>();

// État de chargement
const loadingPopular = ref(false);
const loadingRecent = ref(false);

// Sélections
const selectedMovie = ref<Movie | null>(null);
const selectedSlot = ref<Slot | null>(null);

// Injecter les fonctions de modal
const openReservationModal = inject<(bookingId: string, movieTitle: string, startsAt: string, hall: string) => void>('openReservationModal');

// Films calculés
const availableGenres = computed(() => moviesStore.availableGenres);
const filteredMovies = computed(() => moviesStore.filteredMovies);
const popularMovies = computed(() => moviesStore.popularMovies);
const recentMovies = computed(() => moviesStore.recentMovies);

// Appliquer les filtres
const applyFilters = () => {
  moviesStore.setSearchQuery(searchQuery.value);
  moviesStore.setSelectedGenre(selectedGenre.value);
  moviesStore.setMinRating(minRating.value);
  
  // Recharger les films avec les filtres
  fetchMovies({
    search: searchQuery.value,
    genre: selectedGenre.value,
    minRating: minRating.value,
  });
};

// Sélectionner un film
const selectMovie = (movie: Movie) => {
  selectedMovie.value = movie;
  moviesStore.setSelectedMovieTitle(movie.title);
};

// Sélectionner une séance
const selectSlot = (slot: Slot) => {
  selectedSlot.value = slot;
};

// Gérer la réservation
const handleReserve = async (slotId: string, customerId: string) => {
  try {
    const result = await reserveSlot(slotId, customerId);
    
    // Trouver la séance correspondante
    const slot = availableSlots.value.find(s => s.id === slotId);
    if (slot) {
      // Ouvrir le modal de confirmation
      openReservationModal?.(
        result.bookingId,
        slot.movieTitle,
        slot.startsAt,
        slot.hall
      );
    }
  } catch (err) {
    console.error('Erreur lors de la réservation:', err);
  }
};

// Générer une nouvelle séance de démonstration
const generateDemoSlot = async () => {
  try {
    await generateDemoSlot();
  } catch (err) {
    console.error('Erreur lors de la génération d\'une séance:', err);
  }
};

// Charger les données au montage
onMounted(async () => {
  loadingPopular.value = true;
  loadingRecent.value = true;
  
  try {
    // Charger tous les films
    await fetchMovies();
    
    // Charger les séances
    await fetchSlots();
    
  } catch (err) {
    console.error('Erreur lors du chargement des données:', err);
  } finally {
    loadingPopular.value = false;
    loadingRecent.value = false;
  }
});
</script>

<style scoped>
/* Animation pour le hero */
.hero-section {
  position: relative;
  overflow: hidden;
}

/* Animation pour les cartes */
.movie-card {
  animation: slideUp 0.5s ease-out;
}

.movie-card:nth-child(1) { animation-delay: 0.1s; }
.movie-card:nth-child(2) { animation-delay: 0.2s; }
.movie-card:nth-child(3) { animation-delay: 0.3s; }
.movie-card:nth-child(4) { animation-delay: 0.4s; }
.movie-card:nth-child(5) { animation-delay: 0.5s; }
.movie-card:nth-child(6) { animation-delay: 0.6s; }

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Animation pour les séances */
.slot-card {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.modal-enter-to,
.modal-leave-from {
  opacity: 1;
  transform: scale(1);
}
</style>
