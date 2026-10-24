<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
      <!-- En-tête avec bouton retour -->
      <div class="mb-8 flex items-center justify-between">
        <button
          @click="goBack"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cinema-card/70 hover:bg-cinema-card border border-cinema-border/50 text-cinema-textMuted hover:text-white transition-all text-sm font-semibold cursor-pointer"
        >
          <span>←</span>
          <span>Retour au catalogue</span>
        </button>

        <router-link
          to="/slots"
          class="text-xs text-accent-gold hover:underline font-semibold"
        >
          Voir toutes les séances →
        </router-link>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="animate-pulse space-y-8">
        <div class="h-10 bg-gray-800 rounded-xl w-1/3"></div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div class="h-96 bg-gray-800 rounded-xl"></div>
          <div class="lg:col-span-2 space-y-4">
            <div class="h-6 bg-gray-800 rounded w-1/2"></div>
            <div class="h-32 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error || !movie" class="text-center py-16 bg-cinema-card/30 rounded-2xl border border-cinema-border/40">
        <h2 class="text-xl font-bold text-white mb-2">Film introuvable</h2>
        <p class="text-sm text-cinema-textMuted mb-6">{{ error || "Ce film n'existe pas ou a été retiré." }}</p>
        <router-link
          to="/movies"
          class="px-5 py-2.5 rounded-xl bg-accent-gold text-cinema-dark font-bold text-sm hover:brightness-110 transition-all"
        >
          Retourner aux films
        </router-link>
      </div>

      <!-- Main Content -->
      <div v-else class="space-y-12">
        <!-- Film Hero Card -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-cinema-card/60 p-6 sm:p-8 rounded-2xl border border-cinema-border/50 shadow-cinema backdrop-blur-sm">
          <!-- Affiche -->
          <div class="lg:col-span-1">
            <div class="aspect-poster bg-cinema-darker rounded-xl overflow-hidden border border-cinema-border/60 shadow-lg relative group">
              <img
                v-if="movie.poster"
                :src="movie.poster"
                :alt="`Affiche officielle du film ${movie.title}`"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div v-else class="w-full h-full bg-cinema-darker flex items-center justify-center" aria-hidden="true">
                <span class="text-xs text-cinema-textMuted">Affiche indisponible</span>
              </div>

              <!-- Note IMDB Badge -->
              <div class="absolute top-3 right-3 bg-cinema-dark/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-accent-gold/40 shadow-md flex items-center gap-1.5" :aria-label="`Note IMDB : ${movie.ratings?.imdb?.toFixed(1) || 'N/A'} sur 10`">
                <span class="text-accent-gold text-base" aria-hidden="true">★</span>
                <span class="text-white font-bold text-sm">{{ movie.ratings?.imdb?.toFixed(1) || 'N/A' }}</span>
                <span class="text-cinema-textMuted text-xs" aria-hidden="true">/10</span>
              </div>
            </div>
          </div>
          
          <!-- Détails film -->
          <div class="lg:col-span-2 flex flex-col justify-between">
            <div>
              <h1 class="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
                {{ movie.title }}
              </h1>
              <p class="text-sm text-cinema-textMuted mb-4">
                {{ movie.year }} • {{ movie.duration }} minutes • Réalisé par <strong class="text-white">{{ movie.director }}</strong>
              </p>

              <!-- Genres -->
              <div class="flex flex-wrap gap-2 mb-6">
                <span
                  v-for="(genre, index) in movie.genres"
                  :key="index"
                  class="px-3 py-1 rounded-lg text-xs font-semibold bg-accent-gold/15 text-accent-gold border border-accent-gold/30"
                >
                  {{ genre }}
                </span>
                <span
                  v-if="movie.availableOnStreaming"
                  class="px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                >
                  Disponible en Streaming
                </span>
              </div>

              <!-- Synopsis -->
              <div class="mb-6">
                <h3 class="text-xs font-bold uppercase tracking-wider text-cinema-textMuted mb-2">Synopsis</h3>
                <p class="text-gray-200 text-sm sm:text-base leading-relaxed">
                  {{ movie.synopsis || 'Aucun synopsis disponible pour ce film.' }}
                </p>
              </div>

              <!-- Casting -->
              <div v-if="movie.cast && movie.cast.length > 0" class="mb-6">
                <h3 class="text-xs font-bold uppercase tracking-wider text-cinema-textMuted mb-2">Casting principal</h3>
                <div class="flex flex-wrap gap-2">
                  <span
                    v-for="(actor, index) in movie.cast"
                    :key="index"
                    class="bg-cinema-darker/80 px-3 py-1.5 rounded-lg text-xs text-cinema-text border border-cinema-border/50"
                  >
                    {{ actor }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Meta Data Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-cinema-border/40 text-xs">
              <div class="p-3 rounded-xl bg-cinema-darker/60 border border-cinema-border/30">
                <span class="text-cinema-textMuted block">Année</span>
                <span class="text-white font-bold text-sm">{{ movie.year }}</span>
              </div>
              <div class="p-3 rounded-xl bg-cinema-darker/60 border border-cinema-border/30">
                <span class="text-cinema-textMuted block">Durée</span>
                <span class="text-white font-bold text-sm">{{ movie.duration }} min</span>
              </div>
              <div class="p-3 rounded-xl bg-cinema-darker/60 border border-cinema-border/30">
                <span class="text-cinema-textMuted block">Box-Office</span>
                <span class="text-white font-bold text-sm">{{ movie.boxOffice ? formatCurrency(movie.boxOffice) : 'Non renseigné' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Séances disponibles pour ce film -->
        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-display text-2xl font-bold text-white">Séances programmées</h2>
              </div>
              <p class="text-sm text-cinema-textMuted mt-1">
                Choisissez votre séance ci-dessous pour réserver immédiatement vos fauteuils en temps réel.
              </p>
            </div>
            <span
              v-if="slotsForMovie.length > 0"
              class="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            >
              {{ slotsForMovie.length }} séance{{ slotsForMovie.length > 1 ? 's' : '' }} disponible{{ slotsForMovie.length > 1 ? 's' : '' }}
            </span>
          </div>

          <div v-if="slotsForMovie.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <SlotCard
              v-for="slot in slotsForMovie"
              :key="slot.id"
              :slot="slot"
              :sse-connected="sseConnected"
              @reserve="handleReserve"
            />
          </div>

          <!-- Empty State Séances -->
          <div v-else class="text-center py-12 bg-cinema-card/30 rounded-2xl border border-cinema-border/40 p-6">
            <h3 class="text-lg font-bold text-white mb-1">Aucune séance aujourd'hui</h3>
            <p class="text-xs text-cinema-textMuted max-w-md mx-auto mb-4">
              Ce film n'a pas de séance active pour aujourd'hui. D'autres chefs-d'œuvre sont actuellement à l'affiche.
            </p>
            <router-link
              to="/slots"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent-gold text-cinema-dark font-bold text-xs hover:brightness-110 transition-all"
            >
              <span>Voir toute la programmation</span>
              <span>→</span>
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useMovies } from '../composables/useMovies';
import { useSlots } from '../composables/useSlots';
import { useReservations } from '../composables/useReservations';
import SlotCard from '../components/SlotCard.vue';
import type { Movie } from '../composables/useMovies';
import { cacheManager, CacheKeys } from '../services/cacheManager';

const route = useRoute();
const router = useRouter();
const { fetchMovieById } = useMovies();
const { fetchSlots, connectSse, reserveSlot, sseConnected, slots: allSlots } = useSlots();
const { saveBooking } = useReservations();

const openReservationModal = inject<(bookingId: string, movieTitle: string, startsAt: string, hall: string) => void>('openReservationModal');

const movie = ref<Movie | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

// Récupérer les séances pour ce film (insensible à la casse)
const slotsForMovie = computed(() => {
  if (!movie.value) return [];
  const target = movie.value.title.trim().toLowerCase();
  return allSlots.value.filter(slot => 
    slot.movieTitle.trim().toLowerCase() === target
  );
});

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
};

const loadMovie = async () => {
  const movieId = route.params.id as string;
  
  // Pré-remplissage immédiat depuis le cache (0ms, aucun skeleton si déjà visité)
  const cached = cacheManager.get<Movie>(`${CacheKeys.MOVIE_DETAIL_PREFIX}${movieId}`);
  if (cached?.data) {
    movie.value = cached.data;
  }
  
  if (!movie.value) {
    loading.value = true;
  }
  
  try {
    error.value = null;
    movie.value = await fetchMovieById(movieId);
  } catch (err) {
    if (!movie.value) {
      error.value = 'Impossible de charger les détails du film.';
    }
    console.error('Erreur:', err);
  } finally {
    loading.value = false;
  }
};

const handleReserve = async (slotId: string, customerId: string) => {
  try {
    const result = await reserveSlot(slotId, customerId);
    const slot = allSlots.value.find(s => s.id === slotId);
    
    if (slot && movie.value) {
      saveBooking({
        bookingId: result.bookingId,
        slotId: slot.id,
        movieTitle: movie.value.title,
        startsAt: slot.startsAt,
        hall: slot.hall,
        poster: movie.value.poster
      });

      if (openReservationModal) {
        openReservationModal(
          result.bookingId,
          movie.value.title,
          slot.startsAt,
          slot.hall
        );
      }
    }
  } catch (err) {
    console.error('Erreur lors de la réservation:', err);
  }
};

const goBack = () => {
  if (window.history.length > 2) {
    router.go(-1);
  } else {
    router.push('/movies');
  }
};

watch(() => route.params.id, (newId) => {
  if (newId) {
    loadMovie();
  }
});

onMounted(async () => {
  connectSse();
  await loadMovie();
  await fetchSlots();
});
</script>
