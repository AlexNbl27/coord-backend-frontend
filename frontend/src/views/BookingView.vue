<template>
  <div class="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
    <div class="max-w-3xl mx-auto">
      <div class="mb-6 flex items-center justify-between">
        <button
          @click="goBack"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cinema-card hover:bg-cinema-cardHover border border-cinema-border text-cinema-textMuted hover:text-white transition-colors text-xs font-semibold cursor-pointer"
        >
          <span>←</span>
          <span>Retour aux séances</span>
        </button>

        <router-link to="/reservations" class="text-xs text-accent-gold hover:underline font-semibold">
          Mes billets →
        </router-link>
      </div>

      <div v-if="loading && !slot" class="bg-cinema-card border border-cinema-border rounded-lg p-8 animate-pulse space-y-4">
        <div class="h-7 bg-cinema-darker rounded w-1/2"></div>
        <div class="h-4 bg-cinema-darker rounded w-1/3"></div>
        <div class="h-32 bg-cinema-darker rounded"></div>
      </div>

      <div v-else-if="!slot" class="bg-cinema-card border border-cinema-border rounded-lg p-8 text-center">
        <h1 class="font-display text-2xl font-bold text-white mb-2">Séance introuvable</h1>
        <p class="text-sm text-cinema-textMuted mb-6">
          Ce créneau n'existe plus ou n'est pas disponible.
        </p>
        <router-link
          to="/slots"
          class="inline-block px-5 py-2.5 rounded-md bg-accent-gold text-cinema-dark font-bold text-xs"
        >
          Voir toutes les séances
        </router-link>
      </div>

      <div v-else class="space-y-6">
        <div class="bg-cinema-card border border-cinema-border rounded-lg p-6">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p class="text-xs font-mono uppercase tracking-widest text-accent-gold mb-1">
                Réservation de places
              </p>
              <h1 class="font-display text-2xl sm:text-3xl font-bold text-white">
                {{ slot.movieTitle }}
              </h1>
              <p class="text-sm text-cinema-textMuted mt-1">
                {{ slot.hall }} · <span class="font-mono tabular-nums text-white">{{ formattedStartsAt }}</span>
              </p>
            </div>

            <div class="text-left sm:text-right shrink-0">
              <span
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
                :class="remainingSeats > 0 ? 'bg-green-600/20 text-green-400 border-green-600/30' : 'bg-red-600/20 text-red-400 border-red-600/30'"
              >
                <span aria-hidden="true">{{ remainingSeats > 0 ? '✓' : '⊘' }}</span>
                <span>{{ remainingSeats > 0 ? `${remainingSeats} / ${totalCapacity} places disponibles` : 'Séance complète' }}</span>
              </span>
            </div>
          </div>
        </div>

        <div
          v-if="existingBooking"
          class="bg-cinema-card border border-emerald-500/40 rounded-lg p-6 space-y-4"
        >
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span class="text-xs font-bold uppercase tracking-wider text-emerald-400">
                ✓ Réservation déjà enregistrée
              </span>
              <h2 class="font-display text-xl font-bold text-white mt-1">
                Vous avez déjà un billet pour cette séance
              </h2>
              <p class="text-xs text-cinema-textMuted mt-1">
                {{ existingBooking.seat }} · Référence <span class="font-mono text-white">{{ existingBooking.bookingId.slice(0, 8).toUpperCase() }}</span>
              </p>
            </div>
            <router-link
              to="/reservations"
              class="px-4 py-2 rounded-md bg-accent-gold text-cinema-dark font-bold text-xs text-center shrink-0"
            >
              Gérer mes billets
            </router-link>
          </div>
          <TicketPdfButton
            v-if="existingBooking.status === 'ACTIVE'"
            :booking-id="existingBooking.bookingId"
            :movie-title="existingBooking.movieTitle"
            @unavailable="markBookingCancelled(existingBooking.bookingId)"
          />
        </div>

        <div v-else class="bg-cinema-card border border-cinema-border rounded-lg p-6 space-y-6">
          <div class="flex items-center justify-between border-b border-cinema-border pb-4">
            <div>
              <h2 class="font-display text-lg font-bold text-white">Choix des tarifs</h2>
              <p class="text-xs text-cinema-textMuted mt-0.5">
                Maximum {{ maxSelectable }} place{{ maxSelectable > 1 ? 's' : '' }} disponible{{ maxSelectable > 1 ? 's' : '' }} pour cette commande
              </p>
            </div>
            <span class="text-xs font-mono text-cinema-textMuted">
              {{ totalQuantity }} / {{ maxSelectable }} sélectionnée{{ totalQuantity > 1 ? 's' : '' }}
            </span>
          </div>

          <div class="divide-y divide-cinema-border/60">
            <div
              v-for="tariff in tariffs"
              :key="tariff.category"
              class="py-4 flex items-center justify-between gap-4"
            >
              <div>
                <div class="text-sm font-semibold text-white">{{ tariff.label }}</div>
                <div class="text-xs text-cinema-textMuted">{{ tariff.description }}</div>
              </div>

              <div class="flex items-center gap-4 shrink-0">
                <span class="text-sm font-mono font-bold text-accent-gold w-16 text-right">
                  {{ formatEuro(tariff.unitPrice) }}
                </span>

                <div class="flex items-center gap-2">
                  <button
                    type="button"
                    @click="decrement(tariff.category)"
                    :disabled="quantities[tariff.category] <= 0"
                    :aria-label="`Retirer un billet ${tariff.label}`"
                    class="w-8 h-8 rounded bg-cinema-darker border border-cinema-border text-white font-bold text-sm hover:border-accent-gold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    -
                  </button>
                  <span
                    class="w-8 text-center font-mono text-sm font-bold text-white tabular-nums"
                    aria-live="polite"
                  >
                    {{ quantities[tariff.category] }}
                  </span>
                  <button
                    type="button"
                    @click="increment(tariff.category)"
                    :disabled="totalQuantity >= maxSelectable"
                    :aria-label="`Ajouter un billet ${tariff.label}`"
                    class="w-8 h-8 rounded bg-cinema-darker border border-cinema-border text-white font-bold text-sm hover:border-accent-gold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div v-if="errorMessage" role="alert" class="p-3 rounded bg-red-950/60 border border-red-500/40 text-xs text-red-300">
            {{ errorMessage }}
          </div>

          <div class="pt-4 border-t border-cinema-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span class="text-xs text-cinema-textMuted block">Total à régler</span>
              <span class="text-2xl font-mono font-bold text-white">{{ formatEuro(totalAmount) }}</span>
              <span class="text-xs text-cinema-textMuted ml-2">({{ totalQuantity }} billet{{ totalQuantity > 1 ? 's' : '' }})</span>
            </div>

            <button
              type="button"
              @click="submitBooking"
              :disabled="submitting || totalQuantity < 1 || remainingSeats < 1 || totalQuantity > remainingSeats"
              class="w-full sm:w-auto text-center justify-center px-6 py-3 rounded-md bg-accent-gold hover:bg-accent-goldLight text-cinema-dark font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {{ submitting ? 'Confirmation en cours...' : 'Confirmer la réservation' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, inject, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSlots, type TicketLine } from '../composables/useSlots';
import { useReservations } from '../composables/useReservations';
import { useMoviesStore } from '../stores/movies';
import TicketPdfButton from '../components/TicketPdfButton.vue';

const route = useRoute();
const router = useRouter();
const moviesStore = useMoviesStore();
const { slots, loading, fetchSlots, connectSse, reserveSlot } = useSlots();
const { bookings, saveBooking, markBookingCancelled, syncBookingsWithServer } = useReservations();

const openReservationModal = inject<(bookingId: string, movieTitle: string, startsAt: string, hall: string) => void>('openReservationModal');

const tariffs = [
  { category: 'ADULT', label: 'Adulte', description: 'Tarif plein standard', unitPrice: 11.5 },
  { category: 'YOUTH', label: 'Jeune (-26 ans)', description: 'Étudiant ou moins de 26 ans', unitPrice: 8.0 },
  { category: 'SENIOR', label: 'Senior (65+)', description: 'À partir de 65 ans', unitPrice: 8.5 },
  { category: 'CHILD', label: 'Enfant (-14 ans)', description: 'Moins de 14 ans', unitPrice: 6.0 },
] as const;

const quantities = reactive<Record<string, number>>({
  ADULT: 1,
  YOUTH: 0,
  SENIOR: 0,
  CHILD: 0,
});

const submitting = ref(false);
const errorMessage = ref('');

const slotId = computed(() => String(route.params.id || ''));
const slot = computed(() => slots.value.find((s) => s.id === slotId.value) ?? null);

const totalCapacity = computed(() => slot.value?.capacity ?? 40);
const remainingSeats = computed(() => {
  if (!slot.value) return 0;
  if (slot.value.status === 'BOOKED') return 0;
  return slot.value.availableSeats ?? totalCapacity.value;
});
const maxSelectable = computed(() => Math.min(10, remainingSeats.value));

const totalQuantity = computed(() =>
  Object.values(quantities).reduce((sum, q) => sum + q, 0)
);

const totalAmount = computed(() =>
  tariffs.reduce((sum, t) => sum + t.unitPrice * (quantities[t.category] || 0), 0)
);

const existingBooking = computed(() =>
  bookings.value.find(
    (b) => b.slotId === slotId.value && (b.status === 'ACTIVE' || b.status === 'PENDING_SYNC')
  ) ?? null
);

const formattedStartsAt = computed(() => {
  if (!slot.value) return '';
  return new Date(slot.value.startsAt).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
});

const formatEuro = (amount: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);

const increment = (category: string) => {
  if (totalQuantity.value < maxSelectable.value) {
    quantities[category] = (quantities[category] || 0) + 1;
  }
};

const decrement = (category: string) => {
  if ((quantities[category] || 0) > 0) {
    quantities[category] -= 1;
  }
};

const submitBooking = async () => {
  if (!slot.value || submitting.value || totalQuantity.value < 1) return;
  if (totalQuantity.value > remainingSeats.value) {
    errorMessage.value = `Il ne reste que ${remainingSeats.value} place(s) disponible(s).`;
    return;
  }

  errorMessage.value = '';
  submitting.value = true;

  const selectedTickets: TicketLine[] = tariffs
    .filter((t) => (quantities[t.category] || 0) > 0)
    .map((t) => ({
      category: t.category,
      label: t.label,
      unitPrice: t.unitPrice,
      quantity: quantities[t.category],
    }));

  try {
    const result = await reserveSlot(slot.value.id, '', selectedTickets);
    const movie = moviesStore.movies.find(
      (m) => m.title.toLowerCase() === slot.value!.movieTitle.toLowerCase()
    );

    saveBooking({
      bookingId: result.bookingId,
      slotId: slot.value.id,
      movieTitle: slot.value.movieTitle,
      startsAt: slot.value.startsAt,
      hall: slot.value.hall,
      seat: result.seat,
      tickets: result.tickets ?? selectedTickets,
      totalQuantity: result.totalQuantity ?? totalQuantity.value,
      totalAmount: result.totalAmount ?? totalAmount.value,
      poster: movie?.poster,
    });

    if (openReservationModal) {
      openReservationModal(
        result.bookingId,
        slot.value.movieTitle,
        slot.value.startsAt,
        slot.value.hall
      );
    }
  } catch (err: any) {
    errorMessage.value = err?.message || 'Impossible de finaliser la réservation.';
    await fetchSlots();
  } finally {
    submitting.value = false;
  }
};

const goBack = () => {
  if (window.history.length > 2) {
    router.go(-1);
  } else {
    router.push('/slots');
  }
};

onMounted(async () => {
  connectSse();
  await syncBookingsWithServer();
  if (slots.value.length === 0) {
    await fetchSlots();
  }
  if (remainingSeats.value === 0) {
    quantities.ADULT = 0;
  }
});
</script>
