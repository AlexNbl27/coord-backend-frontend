<template>
  <div class="w-full max-w-4xl mx-auto">
    <!-- Barre de recherche principale -->
    <div class="relative search-bar">
      <div class="absolute left-4 top-1/2 transform -translate-y-1/2 text-cinema-textMuted">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
        </svg>
      </div>
      
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Rechercher un film, un réalisateur, un genre..."
        class="search-input"
        @input="handleSearch"
        @focus="showFilters = true"
      />
      
      <div v-if="searchQuery" class="absolute right-4 top-1/2 transform -translate-y-1/2">
        <button
          @click="clearSearch"
          class="text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 p-1"
          aria-label="Effacer la recherche"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Filtres avancés -->
    <Transition
      enter-active-class="transition-all duration-300 ease-out"
      leave-active-class="transition-all duration-200 ease-in"
      enter-from-class="opacity-0 max-h-0 overflow-hidden"
      leave-to-class="opacity-0 max-h-0 overflow-hidden"
    >
      <div v-if="showFilters" class="mt-4 bg-cinema-card/50 rounded-xl p-4 border border-cinema-border/50">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Filtre par genre -->
          <div>
            <label class="block text-sm font-medium text-cinema-textMuted mb-2">
              Genre
            </label>
            <select
              v-model="selectedGenre"
              class="w-full px-4 py-2 rounded-lg bg-cinema-card border border-cinema-border text-cinema-text focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
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
            <label class="block text-sm font-medium text-cinema-textMuted mb-2">
              Note minimale
            </label>
            <select
              v-model="minRating"
              class="w-full px-4 py-2 rounded-lg bg-cinema-card border border-cinema-border text-cinema-text focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
              @change="applyFilters"
            >
              <option value="">Toutes les notes</option>
              <option value="7">7+</option>
              <option value="8">8+</option>
              <option value="8.5">8.5+</option>
              <option value="9">9+</option>
            </select>
          </div>

          <!-- Filtre par année -->
          <div>
            <label class="block text-sm font-medium text-cinema-textMuted mb-2">
              Année
            </label>
            <select
              v-model="minYear"
              class="w-full px-4 py-2 rounded-lg bg-cinema-card border border-cinema-border text-cinema-text focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
              @change="applyFilters"
            >
              <option value="">Toutes les années</option>
              <option value="2024">2024+</option>
              <option value="2020">2020+</option>
              <option value="2015">2015+</option>
              <option value="2010">2010+</option>
            </select>
          </div>
        </div>

        <!-- Bouton de réinitialisation -->
        <div class="mt-4 flex justify-end">
          <button
            @click="resetFilters"
            class="px-4 py-2 text-sm text-cinema-textMuted hover:text-cinema-text transition-colors duration-200 hover:bg-cinema-card/50 rounded-lg"
          >
            Réinitialiser les filtres
          </button>
        </div>
      </div>
    </Transition>

    <!-- Résultats de la recherche -->
    <div v-if="resultsCount > 0" class="mt-4 text-sm text-cinema-textMuted">
      {{ resultsCount }} résultat{{ resultsCount > 1 ? 's' : '' }} trouvé{{ resultsCount > 1 ? 's' : '' }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useMoviesStore } from '../stores/movies';

const props = defineProps<{
  search?: string;
  genre?: string;
  minRating?: number;
  minYear?: number;
  resultsCount?: number;
  availableGenres?: string[];
}>();

const emit = defineEmits(['search', 'update:search', 'update:genre', 'update:minRating', 'update:minYear']);

const moviesStore = useMoviesStore();

// État local
const searchQuery = ref(props.search || '');
const selectedGenre = ref(props.genre || '');
const minRating = ref(props.minRating || undefined);
const minYear = ref(props.minYear || undefined);
const showFilters = ref(false);

// Genre disponibles (à passer en prop ou récupérer du store)
const availableGenres = computed(() => {
  return props.availableGenres || moviesStore.availableGenres;
});

// Nombre de résultats
const resultsCount = computed(() => {
  return props.resultsCount;
});

// Gérer la recherche
const handleSearch = () => {
  emit('update:search', searchQuery.value);
  emit('search', searchQuery.value);
};

// Appliquer les filtres
const applyFilters = () => {
  emit('update:search', searchQuery.value);
  emit('update:genre', selectedGenre.value || undefined);
  emit('update:minRating', minRating.value || undefined);
  emit('update:minYear', minYear.value || undefined);
  emit('search');
};

// Effacer la recherche
const clearSearch = () => {
  searchQuery.value = '';
  handleSearch();
};

// Réinitialiser les filtres
const resetFilters = () => {
  searchQuery.value = '';
  selectedGenre.value = '';
  minRating.value = undefined;
  minYear.value = undefined;
  applyFilters();
};

// Synchroniser avec les props
watch(() => props.search, (newVal) => {
  if (newVal !== searchQuery.value) {
    searchQuery.value = newVal || '';
  }
});

watch(() => props.genre, (newVal) => {
  if (newVal !== selectedGenre.value) {
    selectedGenre.value = newVal || '';
  }
});

watch(() => props.minRating, (newVal) => {
  if (newVal !== minRating.value) {
    minRating.value = newVal;
  }
});

watch(() => props.minYear, (newVal) => {
  if (newVal !== minYear.value) {
    minYear.value = newVal;
  }
});
</script>

<style scoped>
/* Transition pour les filtres */
.max-h-0 {
  max-height: 0;
}
</style>
