<template>
  <div class="w-full max-w-4xl mx-auto">
    <!-- Barre de recherche principale -->
    <div class="relative flex items-center gap-3">
      <div class="relative flex-1 search-bar">
        <label for="movie-search-input" class="sr-only">
          Rechercher un film, un réalisateur, un genre...
        </label>

        <div class="absolute left-4 top-1/2 -translate-y-1/2 text-cinema-textMuted pointer-events-none flex items-center" aria-hidden="true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
          </svg>
        </div>
        
        <input
          id="movie-search-input"
          v-model="searchQuery"
          type="search"
          role="searchbox"
          aria-label="Rechercher un film, un réalisateur, un genre..."
          placeholder="Rechercher un film, un réalisateur, un genre..."
          class="w-full h-12 pl-12 pr-12 rounded-full bg-cinema-card border border-cinema-border text-cinema-text placeholder-cinema-textMuted text-sm focus:outline-none focus:ring-2 focus:ring-accent-gold/50 focus:border-accent-gold transition-all duration-200"
          @input="handleSearch"
        />
        
        <div v-if="searchQuery" class="absolute right-2 top-1/2 -translate-y-1/2">
          <button
            @click="clearSearch"
            class="w-8 h-8 rounded-full flex items-center justify-center text-cinema-textMuted hover:text-white hover:bg-white/10 transition-colors duration-200 cursor-pointer"
            aria-label="Effacer la recherche"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Bouton d'ouverture explicite des filtres -->
      <button
        @click="showFilters = !showFilters"
        :aria-expanded="showFilters ? 'true' : 'false'"
        aria-controls="advanced-filters-panel"
        aria-label="Filtres de recherche avancés"
        class="h-12 px-5 rounded-full border transition-all text-xs font-semibold flex items-center gap-2 shrink-0 cursor-pointer shadow-sm"
        :class="showFilters || hasCustomFilters ? 'bg-accent-gold text-cinema-dark border-accent-gold shadow-accent-gold/20' : 'bg-cinema-card hover:bg-cinema-cardHover text-cinema-textMuted hover:text-white border-cinema-border'"
        title="Afficher/Masquer les filtres avancés"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span class="hidden sm:inline">Filtres</span>
        <span class="text-[10px]" aria-hidden="true">{{ showFilters ? '▲' : '▼' }}</span>
      </button>
    </div>

    <!-- Annonce vocale dynamique pour VoiceOver -->
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ resultsCount }} film{{ resultsCount > 1 ? 's' : '' }} correspondent à votre recherche
    </div>

    <!-- Filtres avancés -->
    <transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 max-h-0 overflow-hidden"
      leave-to-class="opacity-0 max-h-0 overflow-hidden"
    >
      <div
        id="advanced-filters-panel"
        v-if="showFilters"
        class="mt-4 bg-cinema-card/70 rounded-xl p-5 border border-cinema-border/60 shadow-lg"
      >
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Filtre par genre -->
          <div>
            <label for="filter-genre" class="block text-xs font-medium text-cinema-textMuted mb-2">
              Genre
            </label>
            <select
              id="filter-genre"
              v-model="selectedGenre"
              class="w-full px-3 py-2 rounded-lg bg-cinema-darker border border-cinema-border text-cinema-text text-xs focus:outline-none focus:ring-1 focus:ring-accent-gold/50"
              @change="applyFilters"
            >
              <option value="">Tous les genres</option>
              <option v-for="genre in availableGenres" :key="genre" :value="genre">
                {{ genre }}
              </option>
            </select>
          </div>

          <!-- Filtre par note minimale -->
          <div>
            <label for="filter-rating" class="block text-xs font-medium text-cinema-textMuted mb-2">
              Note minimale
            </label>
            <select
              id="filter-rating"
              v-model="minRating"
              class="w-full px-3 py-2 rounded-lg bg-cinema-darker border border-cinema-border text-cinema-text text-xs focus:outline-none focus:ring-1 focus:ring-accent-gold/50"
              @change="applyFilters"
            >
              <option value="">Toutes les notes</option>
              <option value="7">7+ ★ Bon</option>
              <option value="8">8+ ★ Très bon</option>
              <option value="8.5">8.5+ ★ Chef-d'œuvre</option>
            </select>
          </div>

          <!-- Filtre par année minimale -->
          <div>
            <label for="filter-period" class="block text-xs font-medium text-cinema-textMuted mb-2">
              Période
            </label>
            <select
              id="filter-period"
              v-model="minYear"
              class="w-full px-3 py-2 rounded-lg bg-cinema-darker border border-cinema-border text-cinema-text text-xs focus:outline-none focus:ring-1 focus:ring-accent-gold/50"
              @change="applyFilters"
            >
              <option value="">Toutes les années</option>
              <option value="2020">2020 et après</option>
              <option value="2010">2010 et après</option>
              <option value="2000">2000 et après</option>
              <option value="1990">1990 et après</option>
            </select>
          </div>
        </div>

        <!-- Bouton de réinitialisation -->
        <div class="mt-4 pt-3 border-t border-cinema-border/40 flex items-center justify-between">
          <span class="text-xs text-cinema-textMuted">
            {{ resultsCount }} résultat{{ resultsCount > 1 ? 's' : '' }}
          </span>
          <button
            @click="resetFilters"
            class="px-3 py-1.5 text-xs text-cinema-textMuted hover:text-white transition-colors duration-200 hover:bg-cinema-card/50 rounded-lg cursor-pointer"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { useMoviesStore } from '../stores/movies';

const props = defineProps<{
  search?: string;
  genre?: string;
  minRating?: number;
  minYear?: number;
  resultsCount?: number;
  availableGenres?: string[];
  minSearchLength?: number;
  debounceDelay?: number;
}>();

const emit = defineEmits(['search', 'update:search', 'update:genre', 'update:minRating', 'update:minYear']);

const moviesStore = useMoviesStore();

// État local
const searchQuery = ref(props.search || '');
const selectedGenre = ref(props.genre || '');
const minRating = ref(props.minRating?.toString() || '');
const minYear = ref(props.minYear?.toString() || '');
const showFilters = ref(false);

const hasCustomFilters = computed(() => {
  return Boolean(selectedGenre.value || minRating.value || minYear.value);
});

// Configuration de la recherche réactive
const minSearchLength = computed(() => props.minSearchLength ?? 2);
const debounceDelay = computed(() => props.debounceDelay || 250);

// Timer pour le debounce
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

// Genre disponibles
const availableGenres = computed(() => {
  return props.availableGenres || moviesStore.availableGenres;
});

// Nombre de résultats
const resultsCount = computed(() => {
  return props.resultsCount ?? 0;
});

// Gérer la recherche avec debounce
const handleSearch = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  
  debounceTimer = setTimeout(() => {
    if (searchQuery.value.length >= minSearchLength.value || searchQuery.value.length === 0) {
      emit('update:search', searchQuery.value);
      emit('search', searchQuery.value);
    }
  }, debounceDelay.value);
};

// Appliquer les filtres
const applyFilters = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  emit('update:search', searchQuery.value);
  emit('update:genre', selectedGenre.value || undefined);
  emit('update:minRating', minRating.value ? parseFloat(minRating.value) : undefined);
  emit('update:minYear', minYear.value ? parseInt(minYear.value, 10) : undefined);
  emit('search', searchQuery.value);
};

// Réinitialiser les filtres
const resetFilters = () => {
  selectedGenre.value = '';
  minRating.value = '';
  minYear.value = '';
  applyFilters();
};

// Effacer la recherche
const clearSearch = () => {
  searchQuery.value = '';
  emit('update:search', '');
  emit('search', '');
};

// Synchroniser avec les props
watch(() => props.search, (val) => {
  searchQuery.value = val || '';
});
watch(() => props.genre, (val) => {
  selectedGenre.value = val || '';
});
watch(() => props.minRating, (val) => {
  minRating.value = val?.toString() || '';
});
watch(() => props.minYear, (val) => {
  minYear.value = val?.toString() || '';
});

onUnmounted(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
});
</script>
