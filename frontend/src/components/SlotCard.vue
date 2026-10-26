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
          <h4 class="text-white font-bold text-base sm:text-lg line-clamp-1 leading-snug">
            {{ slot.movieTitle }}
          </h4>
          <p class="text-cinema-textMuted text-xs mt-1">
            {{ slot.hall }}
          </p>
        </div>
        
        <!-- Badge de statut -->
        <span
          class="badge whitespace-nowrap shrink-0"
          :class="{
            'badge-available': slot.status === 'AVAILABLE',
            'badge-booked': slot.status === 'BOOKED'
          }"
        >
          {{ slot.status === 'AVAILABLE' ? 'Disponible' : 'Complet' }}
        </span>
      </div>

      <!-- Horaires -->
      <div class="flex items-center gap-2 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-cinema-textMuted shrink-0" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
        </svg>
        <span class="text-cinema-text text-xs font-semibold">
          {{ formattedStartsAt }}
        </span>
      </div>

      <!-- Hall / Technology Tags -->
      <div class="flex items-center gap-1.5 flex-wrap mb-4">
        <span
          v-if="slot.hall && slot.hall.includes('IMAX')"
          class="px-2 py-0.5 rounded text-xs font-black tracking-wider bg-blue-500/15 text-blue-400 border border-blue-500/30"
        >
          IMAX LASER
        </span>
        <span
          v-else-if="slot.hall && slot.hall.includes('Dolby')"
          class="px-2 py-0.5 rounded text-xs font-black tracking-wider bg-purple-500/15 text-purple-400 border border-purple-500/30"
        >
          DOLBY ATMOS
        </span>
        <span
          v-else-if="slot.hall && slot.hall.includes('70mm')"
          class="px-2 py-0.5 rounded text-xs font-black tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30"
        >
          70MM ANALOG
        </span>
        <span
          class="px-2 py-0.5 rounded text-xs font-medium bg-white/5 text-gray-400 border border-white/5"
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
        class="w-full btn btn-primary text-xs py-2.5"
        :disabled="isReserving || !sseConnected"
      >
        <span v-if="!isReserving" class="flex items-center justify-center gap-2">
          <span>🎟️</span>
          <span>{{ bookingButtonLabel }}</span>
        </span>
        <span v-else class="flex items-center justify-center gap-2">
          <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          <span>Réservation...</span>
        </span>
      </button>

      <!-- Message si SSE non connecté -->
      <div v-else-if="!sseConnected" class="text-center py-2">
        <p class="text-xs text-cinema-textMuted/70">
          Connexion SSE requise pour réserver
        </p>
      </div>

      <!-- Message si séance complète -->
      <div v-else class="text-center py-2">
        <p class="text-xs text-cinema-textMuted/70 font-medium">
          Désolé, cette séance est complète
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import type { Slot } from '../composables/useSlots';
import { useAbTest } from '../composables/useAbTest';

const { bookingButtonLabel } = useAbTest();

const props = defineProps<{
  slot: Slot;
  sseConnected: boolean;
  index?: number;
}>();

const emit = defineEmits(['reserve', 'click']);

const isReserving = ref(false);

// Injecter la fonction pour ouvrir le modal
const openReservationModal = inject<(bookingId: string, movieTitle: string, startsAt: string, hall: string) => void>('openReservationModal');

// Formater la date de la séance
const formattedStartsAt = computed(() => {
  const date = new Date(props.slot.startsAt);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
});

// Gérer la réservation
const handleReserve = async () => {
  if (!props.sseConnected) return;
  
  isReserving.value = true;
  
  try {
    // Générer un ID client aléatoire
    const customerId = `user-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
    
    // Émettre l'événement de réservation
    emit('reserve', props.slot.id, customerId);
    
  } catch (err) {
    console.error('Erreur lors de la réservation:', err);
  } finally {
    isReserving.value = false;
  }
};

// Gérer le clic sur la carte
const handleSlotClick = () => {
  if (props.slot.status === 'AVAILABLE' && props.sseConnected) {
    // Ne pas déclencher si on clique sur le bouton de réservation
  } else {
    emit('click', props.slot);
  }
};
</script>

<style scoped>
/* Animation pour le bouton */
.slot-card:hover:not(.slot-card-booked) {
  border-color: theme('colors.accent.gold');
  box-shadow: 0 0 20px rgba(212, 175, 55, 0.1);
}

/* Style pour les séances disponibles */
.slot-card-available {
  border-color: theme('colors.cinema.border');
}

.slot-card-available:hover {
  border-color: theme('colors.accent.gold');
  transform: translateY(-2px);
}

/* Style pour les séances réservées */
.slot-card-booked {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
