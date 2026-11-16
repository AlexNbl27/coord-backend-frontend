<template>
  <div
    class="slot-card transition-all duration-300 flex flex-col h-full justify-between"
    :class="{
      'slot-card-available': slot.status === 'AVAILABLE',
      'slot-card-booked': slot.status === 'BOOKED'
    }"
    @click="handleSlotClick"
  >
    <!-- Contenu haut -->
    <div>
      <!-- En-tête avec titre du film et statut -->
      <div class="flex justify-between items-start gap-2 mb-3">
        <div class="flex-1">
          <h4 class="font-display text-white font-bold text-base sm:text-lg line-clamp-1 leading-snug">
            {{ slot.movieTitle }}
          </h4>
          <p class="text-cinema-textMuted text-xs mt-1">
            {{ slot.hall }}
          </p>
        </div>
        
        <!-- Badge de statut (double encodage icône + texte pour daltonisme) -->
        <span
          class="badge whitespace-nowrap shrink-0 inline-flex items-center gap-1.5"
          :class="{
            'badge-available': slot.status === 'AVAILABLE',
            'badge-booked': slot.status === 'BOOKED'
          }"
        >
          <span aria-hidden="true" class="font-black text-[11px]">{{ slot.status === 'AVAILABLE' ? '✓' : '⊘' }}</span>
          {{ slot.status === 'AVAILABLE' ? 'Disponible' : 'Complet' }}
        </span>
      </div>

      <!-- Horaires -->
      <div class="flex items-center gap-2 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-cinema-textMuted shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
        </svg>
        <span class="text-cinema-text text-xs font-mono tabular-nums font-semibold">
          {{ formattedStartsAt }}
        </span>
      </div>

      <!-- Hall / Technology Tags -->
      <div class="flex items-center gap-1.5 flex-wrap mb-4" aria-label="Caractéristiques de la séance">
        <span
          v-if="slot.hall && slot.hall.includes('IMAX')"
          class="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider bg-cinema-darker text-cinema-textLight border border-cinema-borderLight"
        >
          IMAX LASER
        </span>
        <span
          v-else-if="slot.hall && slot.hall.includes('Dolby')"
          class="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider bg-cinema-darker text-cinema-textLight border border-cinema-borderLight"
        >
          DOLBY ATMOS
        </span>
        <span
          v-else-if="slot.hall && slot.hall.includes('70mm')"
          class="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider bg-cinema-darker text-cinema-textLight border border-cinema-borderLight"
        >
          70MM ANALOG
        </span>
        <span
          class="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider bg-cinema-darker text-cinema-textMuted border border-cinema-border"
        >
          Fauteuil Club
        </span>
      </div>
    </div>

    <!-- Contenu bas (ancré) -->
    <div class="mt-auto pt-2 border-t border-cinema-border/30">
      <!-- Bouton de réservation -->
      <button
        v-if="slot.status === 'AVAILABLE'"
        @click.stop="handleReserve"
        class="w-full btn btn-primary text-xs py-2.5 cursor-pointer"
        :aria-label="`Réserver une place pour ${slot.movieTitle} à ${formattedStartsAt} en salle ${slot.hall}${!sseConnected ? ' (réservation hors-ligne, synchronisation différée)' : ''}`"
        :disabled="isReserving"
        :aria-busy="isReserving ? 'true' : 'false'"
      >
        <span v-if="!isReserving" class="flex items-center justify-center gap-2">
          <span>{{ bookingButtonLabel }}</span>
          <span v-if="!sseConnected" class="text-[10px] text-amber-200 opacity-80">(différé)</span>
        </span>
        <span v-else class="flex items-center justify-center gap-2">
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden="true"></div>
          <span>Réservation en cours...</span>
        </span>
      </button>

      <!-- Annonce vocale dynamique pour VoiceOver lors de la réservation -->
      <span v-if="isReserving" class="sr-only" aria-live="polite">
        Réservation en cours pour {{ slot.movieTitle }}...
      </span>

      <!-- Message si séance complète ou en attente de synchro -->
      <div v-else class="text-center py-2">
        <span v-if="isPendingSync" class="inline-flex items-center gap-1.5 text-xs text-amber-300 font-semibold bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30">
          <span>En attente de synchronisation</span>
        </span>
        <p v-else class="text-xs text-cinema-textMuted/70 font-medium">
          Désolé, cette séance est complète
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Slot } from '../composables/useSlots';
import { useAbTest } from '../composables/useAbTest';
import { offlineQueue } from '../services/offlineQueue';

const { bookingButtonLabel } = useAbTest();

const props = defineProps<{
  slot: Slot;
  sseConnected: boolean;
  index?: number;
}>();

const emit = defineEmits(['reserve', 'click']);

const isReserving = ref(false);
const isPendingSync = computed(() => offlineQueue.isSlotPendingReservation(props.slot.id));

const formattedStartsAt = computed(() => {
  const date = new Date(props.slot.startsAt);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
});

const handleReserve = () => {
  if (isReserving.value) return;
  isReserving.value = true;
  emit('reserve', props.slot.id, '');
  isReserving.value = false;
};

const handleSlotClick = () => {
  emit('click', props.slot);
};
</script>
