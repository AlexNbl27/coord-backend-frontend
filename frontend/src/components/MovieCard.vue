<template>
  <div
    class="movie-card group"
    @click="handleClick"
  >
    <!-- Image container -->
    <div class="relative overflow-hidden aspect-poster">
      <!-- Poster image -->
      <div class="absolute inset-0 bg-gradient-to-br from-cinema-border to-cinema-darker flex items-center justify-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-cinema-border/50 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      </div>
      
      <!-- Movie poster (if available) -->
      <img
        v-if="movie.poster"
        :src="movie.poster"
        :alt="movie.title"
        class="w-full h-full object-cover"
        loading="lazy"
      />
      
      <!-- Overlay avec infos -->
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-4">
        <!-- Top: Rating -->
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-1">
            <span class="text-yellow-400 text-xl">★</span>
            <span class="text-white font-bold text-lg drop-shadow-md">
              {{ movie.ratings?.imdb?.toFixed(1) || 'N/A' }}
            </span>
          </div>
          
          <!-- Badge disponibilité -->
          <div v-if="movie.availableOnStreaming" class="badge-available">
            Streaming
          </div>
        </div>
        
        <!-- Bottom: Title + Genres -->
        <div>
          <h3 class="text-white font-bold text-lg line-clamp-2 drop-shadow-md">
            {{ movie.title }}
          </h3>
          <p class="text-xs text-cinema-textMuted mt-1">
            {{ movie.year }} • {{ movie.duration }} min
          </p>
          <div class="flex flex-wrap gap-1 mt-2">
            <span
              v-for="(genre, index) in movie.genres?.slice(0, 2)"
              :key="index"
              class="badge-genre"
            >
              {{ genre }}
            </span>
          </div>
        </div>
      </div>
      
      <!-- Play button overlay -->
      <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/30">
        <div class="w-16 h-16 bg-accent-gold/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-accent-gold/50">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-accent-gold" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd" />
          </svg>
        </div>
      </div>
    </div>
    
    <!-- Infos basiques sous l'image -->
    <div class="p-4">
      <p class="text-sm text-cinema-textMuted line-clamp-2">
        {{ movie.synopsis || 'Aucun synopsis disponible.' }}
      </p>
      <p class="text-xs text-cinema-textMuted mt-2">
        Réalisé par {{ movie.director || 'Inconnu' }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Movie } from '../composables/useMovies';

const props = defineProps<{
  movie: Movie;
  index?: number;
}>();

const emit = defineEmits(['click']);

const handleClick = () => {
  emit('click', props.movie);
};
</script>

<style scoped>
/* Animation hover */
.movie-card:hover {
  transform: scale(1.05) translateY(-8px);
}

/* Drop shadow for text */
.drop-shadow-md {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}
</style>
