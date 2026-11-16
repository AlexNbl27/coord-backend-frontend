<template>
  <transition name="modal">
    <div
      v-if="show"
      ref="dialogOverlayRef"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-modal-title"
      aria-describedby="reservation-modal-summary"
      @click.self="close"
    >
      <div
        ref="modalContentRef"
        class="modal-content relative max-w-md w-full mx-4 shadow-2xl focus:outline-none"
        tabindex="-1"
      >
        <!-- Annonce vocale dynamique pour VoiceOver lors de l'ouverture -->
        <div class="sr-only" aria-live="polite">
          {{ isOfflineBooking
            ? `Réservation hors-ligne enregistrée pour le film ${movieTitle}. Fauteuil ${assignedSeat} en salle ${hall}.`
            : `Réservation confirmée avec succès pour le film ${movieTitle}. Séance le ${formattedStartsAt} en salle ${hall}, fauteuil ${assignedSeat}. Référence ${shortBookingRef}.`
          }}
        </div>

        <!-- Description complète contextualisée pour les lecteurs d'écran -->
        <p id="reservation-modal-summary" class="sr-only">
          Billet pour le film {{ movieTitle }}, séance du {{ formattedStartsAt }} en {{ hall }}. Fauteuil attribué : {{ assignedSeat }}. Référence du billet : {{ shortBookingRef }}. {{ isOfflineBooking ? 'Réservation enregistrée localement en attente de synchronisation sur le serveur.' : 'Réservation confirmée et validée en direct sur le serveur.' }}
        </p>

        <!-- Close button -->
        <button
          ref="closeButtonRef"
          @click="close"
          class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-cinema-textMuted hover:text-white hover:bg-white/10 transition-colors duration-200 cursor-pointer text-xl"
          aria-label="Fermer la confirmation de réservation"
        >
          <span aria-hidden="true">✕</span>
        </button>

        <!-- Status Header icon -->
        <div class="text-center mb-6">
          <div
            class="w-16 h-16 mx-auto mb-3 rounded-full flex items-center justify-center shadow-lg border-2"
            :class="isOfflineBooking
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-amber-500/10'
              : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 shadow-emerald-500/10'"
            aria-hidden="true"
          >
            <!-- Icône Horloge/Sablier si hors-ligne -->
            <svg v-if="isOfflineBooking" xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <!-- Icône Check vert si en ligne -->
            <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          
          <h2 id="reservation-modal-title" class="text-2xl font-black text-white tracking-tight">
            {{ isOfflineBooking ? 'Réservation enregistrée !' : 'Réservation confirmée !' }}
          </h2>
          
          <p class="text-cinema-textMuted text-xs mt-1 leading-relaxed px-2">
            {{ isOfflineBooking
              ? 'Votre place a été réservée localement. Elle sera officiellement validée sur le serveur dès le retour de la connexion.'
              : 'Votre place est synchronisée et enregistrée en temps réel sur le serveur.' }}
          </p>
        </div>

        <!-- Reservation details card with uniform divide-y -->
        <div class="mb-6">
          <div class="bg-cinema-darker/80 p-4 rounded-xl border border-cinema-border/60 shadow-inner">
            <div class="divide-y divide-cinema-border/30 text-xs">
              <div class="flex justify-between items-center pb-2.5">
                <span class="text-cinema-textMuted font-medium">Réf. Billet</span>
                <span
                  class="font-mono font-bold px-2 py-0.5 rounded border flex items-center gap-1.5"
                  :class="isOfflineBooking
                    ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                    : 'text-accent-gold bg-accent-gold/10 border-accent-gold/20'"
                >
                  <span>{{ shortBookingRef }}</span>
                  <span v-if="isOfflineBooking" class="text-[10px] uppercase font-normal opacity-75">(provisoire)</span>
                </span>
              </div>
              
              <div class="flex justify-between items-center py-2.5">
                <span class="text-cinema-textMuted font-medium">Film</span>
                <span class="text-white font-bold truncate max-w-[200px]">{{ movieTitle }}</span>
              </div>
              
              <div class="flex justify-between items-center py-2.5">
                <span class="text-cinema-textMuted font-medium">Séance</span>
                <span class="text-white font-semibold">{{ formattedStartsAt }}</span>
              </div>
              
              <div class="flex justify-between items-center py-2.5">
                <span class="text-cinema-textMuted font-medium">Salle</span>
                <span class="text-white font-medium">{{ hall }}</span>
              </div>

              <div class="flex justify-between items-center pt-2.5">
                <span class="text-cinema-textMuted font-medium">Fauteuil attribué</span>
                <span class="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span aria-hidden="true">💺</span>
                  <span>{{ assignedSeat }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-col gap-2.5">
          <div v-if="!isOfflineBooking && bookingId" class="flex justify-center">
            <TicketPdfButton :booking-id="bookingId" :movie-title="movieTitle" />
          </div>

          <button
            @click="goToReservations"
            :aria-label="`Accéder à mes billets et consulter la réservation de ${movieTitle}`"
            class="w-full py-3 rounded-xl bg-gradient-to-r from-accent-gold to-yellow-600 text-cinema-dark font-extrabold text-sm hover:brightness-110 shadow-lg shadow-accent-gold/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <span aria-hidden="true">🎟️</span>
            <span>Accéder à mes Billets</span>
          </button>

          <div class="flex gap-2">
            <button
              v-if="currentBooking"
              @click="downloadCalendar"
              :aria-label="`Ajouter la séance de ${movieTitle} du ${formattedStartsAt} à mon agenda`"
              class="flex-1 py-2.5 rounded-xl border border-cinema-border hover:border-accent-gold/50 text-cinema-text hover:text-white text-xs font-semibold bg-cinema-darker/60 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span aria-hidden="true">📅</span>
              <span>Ajouter à l'agenda</span>
            </button>

            <button
              @click="close"
              aria-label="Fermer la fenêtre"
              class="px-5 py-2.5 rounded-xl bg-cinema-darker hover:bg-cinema-border text-cinema-textMuted hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, toRef } from 'vue';
import { useRouter } from 'vue-router';
import { useReservations } from '../composables/useReservations';
import { useAccessibleDialog } from '../composables/useAccessibleDialog';
import TicketPdfButton from './TicketPdfButton.vue';

const props = defineProps<{
  show: boolean;
  bookingId: string;
  movieTitle: string;
  startsAt: string;
  hall: string;
}>();

const emit = defineEmits(['close']);
const router = useRouter();
const { bookings, downloadCalendarFile } = useReservations();

const dialogOverlayRef = ref<HTMLElement | null>(null);
const modalContentRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

const close = () => {
  emit('close');
};

useAccessibleDialog({
  isOpen: toRef(props, 'show'),
  dialogRef: dialogOverlayRef,
  initialFocusRef: closeButtonRef,
  onClose: close,
});

const currentBooking = computed(() => {
  return bookings.value.find(b => b.bookingId === props.bookingId || b.slotId === props.bookingId);
});

const isOfflineBooking = computed(() => {
  if (props.bookingId?.startsWith('temp_')) return true;
  return currentBooking.value?.status === 'PENDING_SYNC';
});

const shortBookingRef = computed(() => {
  if (!props.bookingId) return '#CS-TICKET';
  return '#' + props.bookingId.substring(0, 8).toUpperCase();
});

const assignedSeat = computed(() => {
  if (currentBooking.value?.seat) {
    return currentBooking.value.seat;
  }
  return 'Rangée E · Fauteuil 14';
});

const goToReservations = () => {
  close();
  router.push('/reservations');
};

const downloadCalendar = () => {
  if (currentBooking.value) {
    downloadCalendarFile(currentBooking.value);
  }
};

// Formater la date de la séance
const formattedStartsAt = computed(() => {
  if (!props.startsAt) return '';
  const date = new Date(props.startsAt);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
});
</script>
