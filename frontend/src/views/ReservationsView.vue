<template>
  <div class="min-h-screen py-10 px-4 sm:px-6 lg:px-8">
    <div class="max-w-5xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div class="flex items-center gap-3">
            <span class="text-3xl">🎟️</span>
            <h1 class="text-3xl font-extrabold text-white tracking-tight">Mes Réservations</h1>
          </div>
          <p class="text-cinema-textMuted text-sm mt-1">
            Retrouvez tous vos billets de cinéma et gérez vos séances en temps réel
          </p>
        </div>

        <div class="flex items-center gap-2 bg-cinema-card/80 p-1 rounded-xl border border-cinema-border/50 backdrop-blur-sm self-start sm:self-auto">
          <button
            @click="filter = 'ALL'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            :class="filter === 'ALL' ? 'bg-accent-gold text-cinema-dark shadow-sm' : 'text-cinema-textMuted hover:text-white'"
          >
            Toutes ({{ bookings.length }})
          </button>
          <button
            @click="filter = 'ACTIVE'"
            class="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            :class="filter === 'ACTIVE' ? 'bg-emerald-500 text-cinema-dark shadow-sm' : 'text-cinema-textMuted hover:text-white'"
          >
            Actives ({{ activeBookingsCount }})
          </button>
          <button
            @click="filter = 'CANCELLED'"
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
          class="mb-6 p-4 rounded-xl flex items-center justify-between shadow-lg"
          :class="toastType === 'success' ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-200' : 'bg-red-950/80 border border-red-500/50 text-red-200'"
        >
          <div class="flex items-center gap-3">
            <span class="text-xl">{{ toastType === 'success' ? '✓' : '⚠️' }}</span>
            <p class="text-sm font-medium">{{ toastMessage }}</p>
          </div>
          <button @click="toastMessage = ''" class="text-sm opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      </transition>

      <!-- Empty State -->
      <div
        v-if="displayedBookings.length === 0"
        class="bg-cinema-card/50 border border-cinema-border/50 rounded-2xl p-12 text-center max-w-xl mx-auto backdrop-blur-sm"
      >
        <div class="w-20 h-20 mx-auto mb-4 bg-cinema-darker/60 rounded-full flex items-center justify-center border border-cinema-border">
          <span class="text-4xl">🎬</span>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">
          {{ filter === 'ALL' ? 'Aucune réservation enregistrée' : filter === 'ACTIVE' ? 'Aucune séance active' : 'Aucune réservation annulée' }}
        </h3>
        <p class="text-cinema-textMuted text-sm mb-6 max-w-md mx-auto">
          {{ filter === 'ALL' ? 'Vous n\'avez pas encore réservé de billet. Découvrez notre programmation et réservez votre fauteuil en quelques clics !' : 'Toutes vos réservations à venir apparaîtront ici.' }}
        </p>
        <router-link
          to="/slots"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-accent-gold to-yellow-600 text-cinema-dark font-bold text-sm hover:brightness-110 shadow-lg shadow-accent-gold/20 transition-all cursor-pointer"
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
          <div class="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-cinema-dark rounded-full border border-cinema-border/60 z-20"></div>

          <!-- Poster / Film visual -->
          <div class="w-full md:w-52 h-48 md:h-auto relative bg-cinema-darker overflow-hidden shrink-0">
            <img
              v-if="booking.poster"
              :src="booking.poster"
              :alt="booking.movieTitle"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-gradient-to-br from-cinema-border/40 to-cinema-darker">
              <span class="text-5xl opacity-40">🎞️</span>
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-cinema-card md:from-transparent md:bg-gradient-to-r md:via-transparent md:to-cinema-card/40"></div>
            
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
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-xl sm:text-2xl font-bold text-white group-hover:text-accent-gold transition-colors">
                    {{ booking.movieTitle }}
                  </h3>
                  <div class="inline-block mt-1 px-2.5 py-0.5 rounded-md bg-accent-gold/10 border border-accent-gold/30 text-accent-gold text-xs font-semibold">
                    {{ booking.hall }}
                  </div>
                </div>

                <div class="text-right">
                  <span class="text-[11px] uppercase tracking-wider text-cinema-textMuted font-mono">Billet N°</span>
                  <p class="font-mono text-xs text-cinema-text font-bold select-all bg-black/40 px-2 py-1 rounded border border-cinema-border/40 mt-0.5">
                    {{ booking.bookingId.substring(0, 13) }}...
                  </p>
                </div>
              </div>

              <!-- Details Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-cinema-border/40">
                <div>
                  <span class="text-xs text-cinema-textMuted">Date & Heure</span>
                  <p class="text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                    <span>🕒</span>
                    <span>{{ formatDateTime(booking.startsAt) }}</span>
                  </p>
                </div>
                <div>
                  <span class="text-xs text-cinema-textMuted">Fauteuil</span>
                  <p class="text-sm font-semibold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                    <span>💺</span>
                    <span>{{ booking.seat || 'Rangée E · Fauteuil 12' }}</span>
                  </p>
                </div>
                <div>
                  <span class="text-xs text-cinema-textMuted">Réservé le</span>
                  <p class="text-sm font-semibold text-white mt-0.5 flex items-center gap-1.5">
                    <span>📅</span>
                    <span>{{ formatDate(booking.bookedAt) }}</span>
                  </p>
                </div>
                <div>
                  <span class="text-xs text-cinema-textMuted">Accès</span>
                  <p class="text-sm font-semibold text-accent-gold mt-0.5 flex items-center gap-1.5">
                    <span>⚡</span>
                    <span>e-Billet Borne</span>
                  </p>
                </div>
              </div>
            </div>

            <!-- Ticket Footer / Actions -->
            <div class="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4 border-t border-cinema-border/30">
              <div class="flex items-center gap-2">
                <button
                  v-if="booking.status === 'ACTIVE' || booking.status === 'PENDING_SYNC'"
                  @click="downloadCalendarFile(booking)"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cinema-darker hover:bg-cinema-border text-cinema-text hover:text-white border border-cinema-border transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Ajouter cet événement à mon calendrier"
                >
                  <span>📅</span>
                  <span>Agenda (.ics)</span>
                </button>
                <button
                  v-if="booking.status === 'ACTIVE' || booking.status === 'PENDING_SYNC'"
                  @click="printTicket"
                  class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cinema-darker hover:bg-cinema-border text-cinema-text hover:text-white border border-cinema-border transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Imprimer ce billet"
                >
                  <span>🖨️</span>
                  <span>Imprimer</span>
                </button>
              </div>

              <div class="flex items-center gap-3 ml-auto">
                <button
                  v-if="booking.status === 'ACTIVE' || booking.status === 'PENDING_SYNC'"
                  @click="confirmCancel(booking)"
                  :disabled="cancellingSlotId === booking.slotId"
                  class="px-4 py-2 rounded-xl text-xs font-bold text-red-400 bg-red-950/40 hover:bg-red-900/60 border border-red-800/50 hover:border-red-600 transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span v-if="cancellingSlotId === booking.slotId" class="inline-block animate-spin">⏳</span>
                  <span>{{ cancellingSlotId === booking.slotId ? 'Annulation...' : 'Annuler ma réservation' }}</span>
                </button>
                <button
                  v-else
                  @click="deleteFromHistory(booking.bookingId)"
                  class="px-3.5 py-2 rounded-xl text-xs font-medium text-cinema-textMuted hover:text-white bg-cinema-darker/50 hover:bg-cinema-darker border border-cinema-border/40 transition-all cursor-pointer"
                  title="Supprimer de l'historique"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>

          <!-- QR Code Section -->
          <div class="hidden lg:flex flex-col items-center justify-center p-6 bg-cinema-darker/60 border-l border-cinema-border/40 shrink-0 text-center">
            <div class="p-2.5 bg-white rounded-xl shadow-md mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-20 h-20 text-black" viewBox="0 0 100 100" fill="currentColor">
                <rect x="0" y="0" width="30" height="30" fill="black"/>
                <rect x="5" y="5" width="20" height="20" fill="white"/>
                <rect x="10" y="10" width="10" height="10" fill="black"/>
                <rect x="70" y="0" width="30" height="30" fill="black"/>
                <rect x="75" y="5" width="20" height="20" fill="white"/>
                <rect x="80" y="10" width="10" height="10" fill="black"/>
                <rect x="0" y="70" width="30" height="30" fill="black"/>
                <rect x="5" y="75" width="20" height="20" fill="white"/>
                <rect x="10" y="80" width="10" height="10" fill="black"/>
                <rect x="35" y="5" width="10" height="10" fill="black"/>
                <rect x="50" y="10" width="10" height="25" fill="black"/>
                <rect x="35" y="25" width="10" height="10" fill="black"/>
                <rect x="10" y="45" width="15" height="10" fill="black"/>
                <rect x="35" y="45" width="30" height="10" fill="black"/>
                <rect x="75" y="40" width="15" height="15" fill="black"/>
                <rect x="40" y="65" width="20" height="10" fill="black"/>
                <rect x="70" y="70" width="10" height="25" fill="black"/>
                <rect x="85" y="75" width="10" height="10" fill="black"/>
                <rect x="45" y="85" width="15" height="10" fill="black"/>
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

    <!-- Modal Confirmation Annulation -->
    <transition
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-150 ease-in"
      enter-from-class="opacity-0 scale-95"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="showConfirmModal && selectedForCancel"
        class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        @click.self="showConfirmModal = false"
      >
        <div class="bg-cinema-card border border-cinema-border rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl">
          <div class="w-14 h-14 mx-auto mb-4 bg-red-950/60 rounded-full flex items-center justify-center border border-red-500/30 text-red-400 text-2xl">
            ⚠️
          </div>
          <h3 class="text-xl font-bold text-white text-center mb-2">Annuler la réservation ?</h3>
          <p class="text-cinema-textMuted text-sm text-center mb-6">
            Êtes-vous sûr de vouloir annuler votre place pour <strong class="text-white">{{ selectedForCancel.movieTitle }}</strong> ({{ selectedForCancel.seat }}) ? Le créneau sera immédiatement libéré pour les autres spectateurs.
          </p>

          <div class="flex gap-3">
            <button
              @click="showConfirmModal = false"
              class="flex-1 py-2.5 rounded-xl bg-cinema-darker text-cinema-text font-semibold text-sm hover:bg-cinema-border transition-colors border border-cinema-border cursor-pointer"
            >
              Conserver
            </button>
            <button
              @click="executeCancel"
              class="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer"
            >
              Confirmer l'annulation
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useReservations, type UserBooking } from '../composables/useReservations';
import { useConnectionStore } from '../stores/connection';

const { bookings, activeBookingsCount, cancelBooking, deleteFromHistory, downloadCalendarFile } = useReservations();
const connectionStore = useConnectionStore();

const filter = ref<'ALL' | 'ACTIVE' | 'CANCELLED'>('ALL');
const cancellingSlotId = ref<string | null>(null);
const showConfirmModal = ref(false);
const selectedForCancel = ref<UserBooking | null>(null);

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
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};
</script>

<style scoped>
@media print {
  body {
    background: white !important;
    color: black !important;
  }
  .print-ticket {
    border: 2px solid #000 !important;
    box-shadow: none !important;
    page-break-inside: avoid;
  }
}
</style>
