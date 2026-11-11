<template>
  <div class="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div class="flex items-center gap-3">
            <h1 class="font-display text-3xl font-bold text-white tracking-tight">Mes Réservations</h1>
          </div>
          <p class="text-cinema-textMuted text-sm mt-1">
            Retrouvez tous vos billets de cinéma et gérez vos séances en temps réel
          </p>
        </div>

        <div class="flex items-center gap-2 bg-cinema-card/80 p-1 rounded-xl border border-cinema-border/50 backdrop-blur-sm self-start sm:self-auto" role="group" aria-label="Filtrer les réservations par statut">
          <button
            @click="filter = 'ALL'"
            :aria-pressed="filter === 'ALL' ? 'true' : 'false'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            :class="filter === 'ALL' ? 'bg-accent-gold text-cinema-dark shadow-sm' : 'text-cinema-textMuted hover:text-white'"
          >
            Toutes ({{ bookings.length }})
          </button>
          <button
            @click="filter = 'ACTIVE'"
            :aria-pressed="filter === 'ACTIVE' ? 'true' : 'false'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            :class="filter === 'ACTIVE' ? 'bg-emerald-500 text-cinema-dark shadow-sm' : 'text-cinema-textMuted hover:text-white'"
          >
            Actives ({{ activeBookingsCount }})
          </button>
          <button
            @click="filter = 'CANCELLED'"
            :aria-pressed="filter === 'CANCELLED' ? 'true' : 'false'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            :class="filter === 'CANCELLED' ? 'bg-red-500/80 text-white shadow-sm' : 'text-cinema-textMuted hover:text-white'"
          >
            Annulées ({{ cancelledCount }})
          </button>
        </div>
      </div>

      <!-- Notification Toast -->
      <transition
        enter-active-class="transition duration-300 ease-out"
        leave-active-class="transition duration-200 ease-in"
        enter-from-class="opacity-0 -translate-y-2"
        leave-to-class="opacity-0 -translate-y-2"
      >
        <div
          v-if="toastMessage"
          role="alert"
          aria-live="assertive"
          class="mb-6 p-4 rounded-xl flex items-center justify-between shadow-lg"
          :class="toastType === 'success' ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200' : 'bg-red-950/80 border border-red-500/50 text-red-200'"
        >
          <div class="flex items-center gap-3">
            <span aria-hidden="true" class="text-base font-bold">{{ toastType === 'success' ? '✓' : '!' }}</span>
            <p class="text-sm font-medium">{{ toastMessage }}</p>
          </div>
          <button @click="toastMessage = ''" class="text-sm opacity-70 hover:opacity-100 cursor-pointer" aria-label="Fermer la notification">✕</button>
        </div>
      </transition>

      <!-- Empty State -->
      <div
        v-if="displayedBookings.length === 0"
        class="bg-cinema-card/50 border border-cinema-border/50 rounded-2xl p-12 text-center max-w-xl mx-auto backdrop-blur-sm"
      >
        <h2 class="text-xl font-bold text-white mb-2">
          {{ filter === 'ALL' ? 'Aucune réservation enregistrée' : filter === 'ACTIVE' ? 'Aucune séance active' : 'Aucune réservation annulée' }}
        </h2>
        <p class="text-cinema-textMuted text-sm mb-6 max-w-md mx-auto">
          {{ filter === 'ALL' ? 'Vous n\'avez pas encore réservé de billet. Découvrez notre programmation et réservez votre fauteuil en quelques clics !' : 'Toutes vos réservations à venir apparaîtront ici.' }}
        </p>
        <router-link
          to="/slots"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-accent-gold hover:bg-accent-goldLight text-cinema-dark font-bold text-sm transition-colors cursor-pointer"
        >
          <span>Voir les séances disponibles</span>
          <span>→</span>
        </router-link>
      </div>

      <!-- Ticket Cards Grid -->
      <div v-else class="space-y-6">
        <div
          v-for="booking in displayedBookings"
          :key="booking.bookingId"
          class="relative bg-cinema-card rounded-2xl border border-cinema-border/60 overflow-hidden shadow-cinema hover:border-cinema-border transition-all flex flex-col md:flex-row group print-ticket"
        >
          <!-- Left Decorative Notch -->
          <div class="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-cinema-dark rounded-full border border-cinema-border/60 z-20" aria-hidden="true"></div>

          <!-- Poster / Film visual -->
          <div class="w-full md:w-52 h-48 md:h-auto relative bg-cinema-darker overflow-hidden shrink-0">
            <img
              v-if="booking.poster"
              :src="booking.poster"
              :alt="`Affiche de ${booking.movieTitle}`"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-cinema-darker text-xs text-cinema-textMuted" aria-hidden="true">
              Affiche indisponible
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-cinema-card md:from-transparent md:bg-gradient-to-r md:via-transparent md:to-cinema-card/40" aria-hidden="true"></div>
            
            <!-- Status Badge on Image -->
            <div class="absolute top-3 left-3 z-10">
              <span
                v-if="booking.status === 'ACTIVE'"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/90 text-cinema-dark backdrop-blur-md shadow-md"
              >
                <span class="w-2 h-2 rounded-full bg-cinema-dark animate-pulse"></span>
                Billet Valide
              </span>
              <span
                v-else-if="booking.status === 'PENDING_SYNC'"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/90 text-cinema-dark backdrop-blur-md shadow-md"
              >
                <span class="w-2 h-2 rounded-full bg-cinema-dark animate-ping"></span>
                En attente de synchronisation
              </span>
              <span
                v-else-if="booking.status === 'CANCELLED_PENDING_SYNC'"
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-600/90 text-white backdrop-blur-md shadow-md"
              >
                Annulation différée
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/80 text-white backdrop-blur-md shadow-md"
              >
                Annulé
              </span>
            </div>
          </div>

          <!-- Main Ticket Content -->
          <div class="flex-1 p-6 flex flex-col justify-between">
            <div>
              <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                <div class="min-w-0">
                  <h2 class="text-xl sm:text-2xl font-bold text-white group-hover:text-accent-gold transition-colors break-words">
                    {{ booking.movieTitle }}
                  </h2>
                  <div class="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-xs font-semibold">
                    {{ booking.hall }}
                  </div>
                </div>

                <div class="sm:text-right shrink-0">
                  <span class="text-[11px] uppercase tracking-wider text-cinema-textMuted font-mono">Billet N°</span>
                  <p class="inline-block sm:block ml-2 sm:ml-0 font-mono text-xs text-cinema-text font-bold select-all bg-black/40 px-2 py-1 rounded border border-cinema-border/40 mt-0.5" :title="booking.bookingId">
                    #{{ booking.bookingId.slice(0, 8).toUpperCase() }}
                  </p>
                </div>
              </div>

              <!-- Details Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-cinema-border/40">
                <div>
                  <span class="text-xs text-cinema-textMuted">Date & Heure</span>
                  <p class="text-sm font-mono tabular-nums font-semibold text-white mt-0.5">
                    <span>{{ formatDateTime(booking.startsAt) }}</span>
                  </p>
                </div>
                <div>
                  <span class="text-xs text-cinema-textMuted">Places & Fauteuils</span>
                  <p class="text-sm font-semibold text-emerald-400 mt-0.5 break-words">
                    <span>{{ booking.seat || 'Rangée E · Fauteuil 12' }}</span>
                  </p>
                  <p v-if="(booking.totalQuantity || 1) > 1 || typeof booking.totalAmount === 'number'" class="text-xs text-cinema-textMuted mt-0.5">
                    {{ booking.totalQuantity || 1 }} place{{ (booking.totalQuantity || 1) > 1 ? 's' : '' }}
                    <span v-if="typeof booking.totalAmount === 'number'"> · {{ booking.totalAmount.toFixed(2).replace('.', ',') }} €</span>
                  </p>
                </div>
                <div>
                  <span class="text-xs text-cinema-textMuted">Réservé le</span>
                  <p class="text-sm font-mono tabular-nums font-semibold text-white mt-0.5">
                    <span>{{ formatDate(booking.bookedAt) }}</span>
                  </p>
                </div>
                <div>
                  <span class="text-xs text-cinema-textMuted">Accès</span>
                  <p class="text-sm font-semibold text-accent-gold mt-0.5">
                    <span>e-Billet Borne</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Ticket Footer / Actions -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-6 pt-4 border-t border-cinema-border/30">
              <div class="flex flex-wrap items-center gap-2">
                <TicketPdfButton
                  v-if="booking.status === 'ACTIVE'"
                  :booking-id="booking.bookingId"
                  :movie-title="booking.movieTitle"
                />
                <button
                  v-if="booking.status === 'ACTIVE' || booking.status === 'PENDING_SYNC'"
                  @click="downloadCalendarFile(booking)"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cinema-darker hover:bg-cinema-border text-cinema-text hover:text-white border border-cinema-border transition-all flex items-center gap-1.5 cursor-pointer"
                  :aria-label="`Ajouter la séance de ${booking.movieTitle} du ${formatDateTime(booking.startsAt)} à mon agenda`"
                  title="Ajouter cet événement à mon calendrier"
                >
                  <span>Agenda (.ics)</span>
                </button>
                <button
                  v-if="booking.status === 'ACTIVE' || booking.status === 'PENDING_SYNC'"
                  @click="openGoogleCalendar(booking)"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cinema-darker hover:bg-cinema-border text-cinema-text hover:text-white border border-cinema-border transition-all flex items-center gap-1.5 cursor-pointer"
                  :aria-label="`Exporter vers Google Agenda la séance de ${booking.movieTitle} du ${formatDateTime(booking.startsAt)}`"
                  title="Ajouter à Google Agenda"
                >
                  <span>Google Agenda</span>
                </button>
                <button
                  v-if="booking.status === 'ACTIVE' || booking.status === 'PENDING_SYNC'"
                  @click="printTicket"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cinema-darker hover:bg-cinema-border text-cinema-text hover:text-white border border-cinema-border transition-all flex items-center gap-1.5 cursor-pointer"
                  :aria-label="`Imprimer le billet pour ${booking.movieTitle}, fauteuil ${booking.seat || 'non spécifié'}`"
                  title="Imprimer ce billet"
                >
                  <span>Imprimer</span>
                </button>
              </div>

              <div class="w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-cinema-border/20 flex justify-end">
                <button
                  v-if="booking.status === 'ACTIVE' || booking.status === 'PENDING_SYNC'"
                  @click="confirmCancel(booking)"
                  :disabled="cancellingSlotId === booking.slotId"
                  :aria-label="`Annuler ma réservation pour le film ${booking.movieTitle}, séance du ${formatDateTime(booking.startsAt)}`"
                  class="w-full sm:w-auto justify-center px-4 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 hover:border-red-600 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>{{ cancellingSlotId === booking.slotId ? 'Annulation...' : 'Annuler ma réservation' }}</span>
                </button>
                <button
                  v-else
                  @click="deleteFromHistory(booking.bookingId)"
                  :aria-label="`Supprimer de mon historique le billet pour ${booking.movieTitle}`"
                  class="w-full sm:w-auto px-3.5 py-2 rounded-xl text-xs font-medium text-cinema-textMuted hover:text-white bg-cinema-darker/50 hover:bg-cinema-darker border border-cinema-border/40 transition-all cursor-pointer"
                  title="Supprimer de l'historique"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>

          <!-- QR Code Section -->
          <div class="hidden lg:flex flex-col items-center justify-center p-6 bg-cinema-darker/60 border-l border-cinema-border/40 shrink-0 text-center" aria-hidden="true">
            <div class="p-2.5 bg-white rounded-xl shadow-md mb-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="w-20 h-20"
                :viewBox="`0 0 ${qrCodes.get(booking.bookingId)?.size ?? 0} ${qrCodes.get(booking.bookingId)?.size ?? 0}`"
                shape-rendering="crispEdges"
                aria-hidden="true"
              >
                <rect
                  v-for="(cell, idx) in qrCodes.get(booking.bookingId)?.cells ?? []"
                  :key="idx"
                  :x="cell.x"
                  :y="cell.y"
                  width="1"
                  height="1"
                  fill="black"
                />
              </svg>
            </div>
            <span class="text-[10px] font-mono text-cinema-textMuted uppercase tracking-wider">Flash Borne</span>
            <span class="text-[10px] font-bold text-accent-gold mt-0.5">Accès Direct</span>
          </div>

          <!-- Right Decorative Notch -->
          <div class="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-cinema-dark rounded-full border border-cinema-border/60 z-20"></div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <transition
        enter-active-class="transition duration-200 ease-out"
        leave-active-class="transition duration-150 ease-in"
        enter-from-class="opacity-0 scale-95"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="showConfirmModal && selectedForCancel"
        ref="confirmModalRef"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-cancel-title"
        aria-describedby="confirm-cancel-desc"
        class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showConfirmModal = false"
      >
        <div class="bg-cinema-card border border-cinema-border rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
          <div class="w-12 h-12 mx-auto mb-4 bg-red-950/60 rounded-full flex items-center justify-center border border-red-500/30 text-red-400 text-xl font-bold" aria-hidden="true">
            !
          </div>
          <h2 id="confirm-cancel-title" class="text-xl font-bold text-white text-center mb-2">Annuler la réservation ?</h2>
          <p id="confirm-cancel-desc" class="text-cinema-textMuted text-sm text-center mb-6">
            Êtes-vous sûr de vouloir annuler {{ (selectedForCancel.totalQuantity || 1) > 1 ? `vos ${selectedForCancel.totalQuantity} places` : 'votre place' }} pour <strong class="text-white">{{ selectedForCancel.movieTitle }}</strong> ({{ selectedForCancel.seat }}) ? Le créneau sera immédiatement libéré pour les autres spectateurs.
          </p>

          <div class="flex gap-3">
            <button
              ref="keepButtonRef"
              @click="showConfirmModal = false"
              :aria-label="`Conserver ma réservation pour le film ${selectedForCancel.movieTitle}`"
              class="flex-1 py-2.5 rounded-xl bg-cinema-darker text-cinema-text font-semibold text-sm hover:bg-cinema-border transition-colors border border-cinema-border cursor-pointer"
            >
              Conserver
            </button>
            <button
              @click="executeCancel"
              :aria-label="`Confirmer définitivement l'annulation de ma place pour ${selectedForCancel.movieTitle}`"
              class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              Confirmer l'annulation
            </button>
          </div>
        </div>
      </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import QRCode from 'qrcode';
import { ref, computed } from 'vue';
import { useReservations, type UserBooking } from '../composables/useReservations';
import { useConnectionStore } from '../stores/connection';
import { useAccessibleDialog } from '../composables/useAccessibleDialog';
import TicketPdfButton from '../components/TicketPdfButton.vue';

const { bookings, activeBookingsCount, cancelBooking, deleteFromHistory, downloadCalendarFile, openGoogleCalendar } = useReservations();
const connectionStore = useConnectionStore();

const filter = ref<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');
const cancellingSlotId = ref<string | null>(null);
const showConfirmModal = ref(false);
const selectedForCancel = ref<UserBooking | null>(null);

const confirmModalRef = ref<HTMLElement | null>(null);
const keepButtonRef = ref<HTMLButtonElement | null>(null);

useAccessibleDialog({
  isOpen: showConfirmModal,
  dialogRef: confirmModalRef,
  initialFocusRef: keepButtonRef,
  onClose: () => {
    showConfirmModal.value = false;
  },
});

const toastMessage = ref('');
const toastType = ref<'success' | 'error'>('success');

const cancelledCount = computed(() => {
  return bookings.value.filter(b => b.status === 'CANCELLED' || b.status === 'CANCELLED_PENDING_SYNC').length;
});

const displayedBookings = computed(() => {
  if (filter.value === 'ACTIVE') {
    return bookings.value.filter(b => b.status === 'ACTIVE' || b.status === 'PENDING_SYNC');
  }
  if (filter.value === 'CANCELLED') {
    return bookings.value.filter(b => b.status === 'CANCELLED' || b.status === 'CANCELLED_PENDING_SYNC');
  }
  return bookings.value;
});

const confirmCancel = (booking: UserBooking) => {
  selectedForCancel.value = booking;
  showConfirmModal.value = true;
};

const executeCancel = async () => {
  if (!selectedForCancel.value) return;
  const booking = selectedForCancel.value;
  showConfirmModal.value = false;
  cancellingSlotId.value = booking.slotId;

  try {
    await cancelBooking(booking.slotId);
    toastType.value = 'success';
    if (connectionStore.isOffline || booking.status === 'CANCELLED_PENDING_SYNC') {
      toastMessage.value = `Annulation enregistrée pour "${booking.movieTitle}". Elle sera synchronisée avec le serveur dès le retour de la connexion.`;
    } else {
      toastMessage.value = `Votre réservation pour "${booking.movieTitle}" a bien été annulée.`;
    }
  } catch (err: any) {
    toastType.value = 'error';
    toastMessage.value = 'Une erreur est survenue lors de l\'annulation. Veuillez réessayer.';
  } finally {
    cancellingSlotId.value = null;
    selectedForCancel.value = null;
  }
};

const printTicket = () => {
  window.print();
};

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return 'Horaire à confirmer';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    });
  } catch {
    return dateStr;
  }
};

// Real QR code of the booking id, same payload as the PDF ticket.
const qrCode = (bookingId: string) => {
  const { modules } = QRCode.create(bookingId, { errorCorrectionLevel: 'M' });
  const cells: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < modules.size; y += 1) {
    for (let x = 0; x < modules.size; x += 1) {
      if (modules.get(y, x)) cells.push({ x, y });
    }
  }
  return { size: modules.size, cells };
};
const qrCodes = computed(() => new Map(displayedBookings.value.map((b) => [b.bookingId, qrCode(b.bookingId)])));

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Paris'
    });
  } catch {
    return dateStr;
  }
};
</script>

<style scoped>
@media print {
  .print-ticket {
    border: 2px solid #000 !important;
    box-shadow: none !important;
    page-break-inside: avoid;
  }
}
</style>
