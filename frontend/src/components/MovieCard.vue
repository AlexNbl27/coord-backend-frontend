<template>
  <article
    class="movie-card group flex flex-col h-full justify-between focus-within:ring-2 focus-within:ring-accent-gold rounded-xl transition-all duration-300"
    role="region"
    :aria-label="`Film : ${movie.title}`"
  >
    <button
      type="button"
      class="w-full text-left cursor-pointer focus:outline-none flex flex-col h-full justify-between"
      :aria-label="accessibleLabel"
      @click="handleClick"
    >
      <!-- Top section: Poster & Overlays -->
      <div class="w-full">
        <!-- Image container -->
        <div class="relative overflow-hidden aspect-poster rounded-t-xl">
          <!-- Poster placeholder if not available -->
          <div v-if="!movie.poster" class="absolute inset-0 bg-gradient-to-br from-cinema-border to-cinema-darker flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-cinema-border/50 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <!-- Movie poster (if available) -->
          <img
            v-if="movie.poster"
            :src="movie.poster"
            :alt="`Affiche officielle du film ${movie.title}`"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            style="height: 100% !important; width: 100% !important; object-fit: cover !important;"
            loading="lazy"
          />
          
          <!-- Overlay avec infos -->
          <div class="absolute inset-0 bg-gradient-to-t from-cinema-dark via-cinema-dark/30 to-transparent flex flex-col justify-between p-4 pointer-events-none" aria-hidden="true">
            <!-- Top: Rating + Cinema Badge -->
            <div class="flex justify-between items-start pointer-events-auto">
              <div class="inline-flex items-center gap-1.5 bg-cinema-dark/85 backdrop-blur-md px-2.5 py-1 rounded-full border border-accent-gold/40 shadow-sm leading-none">
                <span class="text-accent-gold text-xs leading-none" aria-hidden="true">★</span>
                <span class="text-cinema-text font-bold text-xs leading-none">
                  {{ movie.ratings?.imdb?.toFixed(1) || 'N/A' }}
                </span>
              </div>
              
              <!-- Badge cinéma réel -->
              <div
                v-if="movie.ratings?.imdb && movie.ratings.imdb >= 8.6"
                class="bg-amber-500/20 text-accent-gold text-xs px-2.5 py-1 rounded border border-amber-500/40 font-semibold backdrop-blur-md inline-flex items-center gap-1 shadow-sm leading-none"
              >
                <span aria-hidden="true">★</span>
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
              <h3 class="font-display text-white font-bold text-lg line-clamp-1 drop-shadow-md group-hover:text-accent-gold transition-colors">
                {{ movie.title }}
              </h3>
              <p class="text-xs text-gray-300 font-medium mt-0.5">
                {{ movie.year }} • {{ movie.duration }} min
              </p>
              <div class="flex flex-wrap gap-1 mt-2">
                <span
                  v-for="(genre, idx) in movie.genres?.slice(0, 2)"
                  :key="idx"
                  class="text-xs px-2 py-0.5 rounded bg-black/50 text-gray-200 border border-white/10 backdrop-blur-sm"
                >
                  {{ genre }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Hover action pill -->
          <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px] pointer-events-none" aria-hidden="true">
            <div class="px-4 py-2 rounded-md bg-cinema-dark/95 flex items-center gap-2 border border-accent-gold/60 text-accent-gold shadow-lg">
              <span class="text-xs font-bold text-white tracking-wide">Séances & Détails</span>
              <span class="text-accent-gold text-xs">→</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Infos basiques sous l'image avec hauteur minimale uniforme -->
      <div class="p-4 flex-1 flex flex-col justify-between border-t border-cinema-border/20 w-full">
        <p class="text-xs text-cinema-textMuted line-clamp-2 leading-relaxed" aria-hidden="true">
          {{ movie.synopsis || 'Aucun synopsis disponible.' }}
        </p>
        <div class="pt-2.5 mt-2 border-t border-cinema-border/30 flex items-center justify-between text-xs text-cinema-textMuted" aria-hidden="true">
          <span class="truncate max-w-[150px]">Dir. {{ movie.director || 'Inconnu' }}</span>
          <span class="text-accent-gold font-medium group-hover:underline">Voir les détails →</span>
        </div>
      </div>
    </button>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Movie } from '../composables/useMovies';

const props = defineProps<{
  movie: Movie;
  index?: number;
}>();

const emit = defineEmits(['click']);

const accessibleLabel = computed(() => {
  const rating = props.movie.ratings?.imdb ? `${props.movie.ratings.imdb.toFixed(1)} sur 10` : 'non noté';
  return `Film : ${props.movie.title}, note ${rating}, sorti en ${props.movie.year}, durée ${props.movie.duration} minutes. Cliquer pour voir les séances et détails.`;
});

const handleClick = () => {
  emit('click', props.movie);
};
</script>

<style scoped>
.movie-card:hover {
  transform: translateY(-2px);
}

.drop-shadow-md {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}
</style>
