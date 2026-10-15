<template>
  <div
    class="movie-card group flex flex-col h-full justify-between"
    @click="handleClick"
  >
    <!-- Top section: Poster & Overlays -->
    <div>
      <!-- Image container -->
      <div class="relative overflow-hidden aspect-poster">
        <!-- Poster placeholder if not available -->
        <div v-if="!movie.poster" class="absolute inset-0 bg-gradient-to-br from-cinema-border to-cinema-darker flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-cinema-border/50 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        
        <!-- Movie poster (if available) -->
        <img
          v-if="movie.poster"
          :src="movie.poster"
          :alt="movie.title"
          class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          style="height: 100% !important; width: 100% !important; object-fit: cover !important;"
          loading="lazy"
        />
        
        <!-- Overlay avec infos -->
        <div class="absolute inset-0 bg-gradient-to-t from-cinema-dark via-cinema-dark/30 to-transparent flex flex-col justify-between p-4 pointer-events-none">
          <!-- Top: Rating + Cinema Badge -->
          <div class="flex justify-between items-start pointer-events-auto">
            <div class="inline-flex items-center gap-1.5 bg-cinema-dark/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-accent-gold/40 shadow-sm leading-none">
              <span class="text-accent-gold text-xs leading-none">★</span>
              <span class="text-cinema-text font-bold text-xs leading-none">
                {{ movie.ratings?.imdb?.toFixed(1) || 'N/A' }}
              </span>
            </div>
            
            <!-- Badge cinéma réel -->
            <div
              v-if="movie.ratings?.imdb && movie.ratings.imdb >= 8.6"
              class="bg-amber-500/20 text-accent-gold text-xs px-2.5 py-1 rounded-full border border-amber-500/40 font-semibold backdrop-blur-md inline-flex items-center gap-1 shadow-sm leading-none"
            >
              <span>🏆</span>
              <span>Coup de Cœur</span>
            </div>
            <div
              v-else
              class="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full border border-emerald-500/30 font-semibold backdrop-blur-md shadow-sm leading-none"
            >
              À l'Affiche
            </div>
          </div>
          
          <!-- Bottom: Title + Genres -->
          <div class="pointer-events-auto">
            <h3 class="text-white font-bold text-lg line-clamp-1 drop-shadow-md group-hover:text-accent-gold transition-colors">
              {{ movie.title }}
            </h3>
            <p class="text-xs text-gray-300 font-medium mt-0.5">
              {{ movie.year }} • {{ movie.duration }} min
            </p>
            <div class="flex flex-wrap gap-1 mt-2">
              <span
                v-for="(genre, index) in movie.genres?.slice(0, 2)"
                :key="index"
                class="text-xs px-2 py-0.5 rounded bg-black/50 text-gray-200 border border-white/10 backdrop-blur-sm"
              >
                {{ genre }}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Hover action pill (No false play button affordance) -->
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px] pointer-events-none">
          <div class="px-4 py-2 rounded-xl bg-cinema-dark/95 backdrop-blur-md flex items-center gap-2 border border-accent-gold/60 text-accent-gold shadow-lg shadow-black/80 transform group-hover:scale-105 transition-transform duration-300">
            <span class="text-sm">🎟️</span>
            <span class="text-xs font-bold text-white tracking-wide">Séances & Détails</span>
            <span class="text-accent-gold text-xs">→</span>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Infos basiques sous l'image avec hauteur minimale uniforme -->
    <div class="p-4 flex-1 flex flex-col justify-between border-t border-cinema-border/20">
      <p class="text-xs text-cinema-textMuted line-clamp-2 leading-relaxed">
        {{ movie.synopsis || 'Aucun synopsis disponible.' }}
      </p>
      <div class="pt-2.5 mt-2 border-t border-cinema-border/30 flex items-center justify-between text-xs text-cinema-textMuted">
        <span class="truncate max-w-[150px]">Dir. {{ movie.director || 'Inconnu' }}</span>
        <span class="text-accent-gold font-medium group-hover:underline">Voir →</span>
      </div>
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
