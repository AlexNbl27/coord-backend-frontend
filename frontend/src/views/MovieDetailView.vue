<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-7xl mx-auto">
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

      <div v-else class="space-y-12">
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 bg-cinema-card/60 p-6 sm:p-8 rounded-2xl border border-cinema-border/50 shadow-cinema backdrop-blur-sm">
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

              <div class="absolute top-3 right-3 bg-cinema-dark/85 backdrop-blur-md px-3 py-1.5 rounded-full border border-accent-gold/40 shadow-md flex items-center gap-1.5" :aria-label="`Note IMDB : ${movie.ratings?.imdb?.toFixed(1) || 'N/A'} sur 10`">
                <span class="text-accent-gold text-base" aria-hidden="true">★</span>
                <span class="text-white font-bold text-sm">{{ movie.ratings?.imdb?.toFixed(1) || 'N/A' }}</span>
                <span class="text-cinema-textMuted text-xs" aria-hidden="true">/10</span>
              </div>
            </div>
          </div>
          
          <div class="lg:col-span-2 flex flex-col justify-between">
            <div>
              <h1 class="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-2">
                {{ movie.title }}
              </h1>
              <p class="text-sm text-cinema-textMuted mb-4">
                {{ movie.year }} • {{ movie.duration }} minutes • Réalisé par <strong class="text-white">{{ movie.director }}</strong>
              </p>

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

              <div class="mb-6">
                <h3 class="text-xs font-bold uppercase tracking-wider text-cinema-textMuted mb-2">Synopsis</h3>
                <p class="text-gray-200 text-sm sm:text-base leading-relaxed">
                  {{ movie.synopsis || 'Aucun synopsis disponible pour ce film.' }}
                </p>
              </div>

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

        <section
          v-if="activeMovieBookings.length > 0"
          class="mb-10 p-6 rounded-2xl bg-cinema-card/80 border border-emerald-500/30 space-y-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-display text-xl font-bold text-white">Vos billets pour ce film</h2>
              <p class="text-xs text-cinema-textMuted mt-0.5">
                Vous avez déjà réservé {{ activeMovieBookings.length }} séance{{ activeMovieBookings.length > 1 ? 's' : '' }} pour {{ movie.title }}.
              </p>
            </div>
            <router-link
              to="/reservations"
              class="text-xs font-bold text-accent-gold hover:underline"
            >
              Gérer mes réservations →
            </router-link>
          </div>

          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div
              v-for="booking in activeMovieBookings"
              :key="booking.bookingId"
              class="p-4 rounded-xl bg-cinema-darker/70 border border-cinema-border/60 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              <div class="min-w-0 flex-1 space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                    {{ booking.status === 'PENDING_SYNC' ? 'Synchro en attente' : 'Confirmé' }}
                  </span>
                  <span
                    class="text-xs font-mono text-cinema-textMuted truncate max-w-[140px]"
                    :title="booking.bookingId"
                  >
                    #{{ booking.bookingId.slice(0, 8).toUpperCase() }}
                  </span>
                </div>
                <p class="text-sm font-semibold text-white break-words">
                  {{ booking.hall }} · {{ booking.totalQuantity || 1 }} place{{ (booking.totalQuantity || 1) > 1 ? 's' : '' }}
                  <span v-if="typeof booking.totalAmount === 'number'" class="text-cinema-textMuted font-normal">
                    ({{ booking.totalAmount.toFixed(2).replace('.', ',') }} €)
                  </span>
                </p>
                <p v-if="booking.seat" class="text-xs text-accent-gold font-mono break-words">
                  {{ booking.seat }}
                </p>
                <p class="text-xs text-cinema-textMuted">
                  {{ formatBookingDate(booking.startsAt) }}
                </p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <TicketPdfButton
                  v-if="booking.status === 'ACTIVE'"
                  :booking-id="booking.bookingId"
                  :movie-title="booking.movieTitle"
                  :cinema-slug="booking.cinemaSlug"
                  @unavailable="markBookingCancelled(booking.bookingId)"
                />
              </div>
            </div>
          </div>
        </section>

        <div class="space-y-6">
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-center gap-2">
                <h2 class="font-display text-2xl font-bold text-white">Séances programmées</h2>
              </div>
              <p class="text-sm text-cinema-textMuted mt-1">
                {{ isPublicPlane ? 'Choisissez votre cinéma et votre séance ci-dessous pour réserver vos fauteuils.' : 'Choisissez votre séance ci-dessous pour réserver immédiatement vos fauteuils en temps réel.' }}
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
            <div
              v-for="slot in slotsForMovie"
              :key="`${slot.cinemaSlug || 't'}-${slot.id}`"
              class="flex flex-col gap-1.5"
            >
              <a
                v-if="slot.cinemaName && slot.cinemaSlug && isValidSlug(slot.cinemaSlug)"
                :href="tenantUrl(slot.cinemaSlug, '/slots')"
                class="text-xs font-semibold text-accent-gold hover:underline px-1"
              >
                {{ slot.cinemaName }}
              </a>
              <SlotCard
                :slot="slot"
                :sse-connected="sseConnected"
                :is-public-plane="isPublicPlane"
                :is-offline="isOffline"
                :already-booked="bookedSlotIds.has(slot.id)"
                @reserve="() => handleReserve(slot.id, slot.cinemaSlug)"
              />
            </div>
          </div>

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
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { currentHostContext, isValidSlug, tenantUrl } from '../services/tenant';
import { useMovies } from '../composables/useMovies';
import { useSlots } from '../composables/useSlots';
import { useReservations } from '../composables/useReservations';
import { useConnection } from '../composables/useConnection';
import SlotCard from '../components/SlotCard.vue';
import TicketPdfButton from '../components/TicketPdfButton.vue';
import type { Movie } from '../composables/useMovies';
import { cacheManager, CacheKeys } from '../services/cacheManager';

const route = useRoute();
const router = useRouter();
const { fetchMovieById } = useMovies();
const { fetchSlots, connectSse, sseConnected, slots: allSlots } = useSlots();
const { bookings, markBookingCancelled, syncBookingsWithServer, fetchAllCinemasBookings } = useReservations();
const { isOffline } = useConnection();

const isPublicPlane = computed(() => {
  try {
    return currentHostContext().plane === 'public';
  } catch {
    return false;
  }
});

const formatBookingDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Date à confirmer';
  return d.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
};

const movie = ref<Movie | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const activeMovieBookings = computed(() => {
  if (!movie.value) return [];
  const target = movie.value.title.trim().toLowerCase();
  return (bookings?.value ?? []).filter(
    (b) =>
      (b.status === 'ACTIVE' || b.status === 'PENDING_SYNC') &&
      b.movieTitle.trim().toLowerCase() === target
  );
});

const bookedSlotIds = computed(() => new Set(activeMovieBookings.value.map((b) => b.slotId)));

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

const handleReserve = (slotId: string, cinemaSlug?: string) => {
  if (cinemaSlug && isValidSlug(cinemaSlug) && currentHostContext().plane === 'public') {
    window.location.href = tenantUrl(cinemaSlug, `/slots/${slotId}/book`);
    return;
  }
  router.push(`/slots/${slotId}/book`);
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
  if (!isPublicPlane.value) {
    connectSse();
  }
  await Promise.all([
    loadMovie(),
    isPublicPlane.value ? fetchAllCinemasBookings() : syncBookingsWithServer(),
    fetchSlots()
  ]);
});
</script>
