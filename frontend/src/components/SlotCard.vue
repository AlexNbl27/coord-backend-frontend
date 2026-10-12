<template>
  <div
    class="slot-card transition-all duration-300"
    :class="{
      'slot-card-available': slot.status === 'AVAILABLE',
      'slot-card-booked': slot.status === 'BOOKED'
    }"
    @click="handleSlotClick"
  >
    <!-- En-tête avec titre du film et statut -->
    <div class="flex justify-between items-start mb-3">
      <div class="flex-1">
        <h4 class="text-white font-bold text-lg line-clamp-1">
          {{ slot.movieTitle }}
        </h4>
        <p class="text-cinema-textMuted text-sm mt-1">
          {{ slot.hall }}
        </p>
      </div>
      
      <!-- Badge de statut -->
      <span
        class="badge whitespace-nowrap"
        :class="{
          'badge-available': slot.status === 'AVAILABLE',
          'badge-booked': slot.status === 'BOOKED'
        }"
      >
        {{ slot.status === 'AVAILABLE' ? 'Disponible' : 'Complet' }}
      </span>
    </div>

    <!-- Horaires -->
    <div class="flex items-center gap-2 mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cinema-textMuted" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
      </svg>
      <span class="text-cinema-text text-sm">
        {{ formattedStartsAt }}
      </span>
    </div>

    <!-- Version (pour le debug) -->
    <div class="text-xs text-cinema-textMuted/50">
      v{{ slot.version }}
    </div>

    <!-- Bouton de réservation -->
    <button
      v-if="slot.status === 'AVAILABLE'"
      @click.stop="handleReserve"
      class="mt-3 w-full btn btn-primary"
      :disabled="isReserving || !sseConnected"
    >
      <span v-if="!isReserving">Réserver</span>
      <span v-else class="flex items-center justify-center gap-2">
        <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        Réservation...
      </span>
    </button>

    <!-- Message si SSE non connecté -->
    <div v-else-if="!sseConnected" class="mt-3 text-center">
      <p class="text-xs text-cinema-textMuted/70">
        Connexion SSE requise pour réserver
      </p>
    </div>

    <!-- Message si séance complète -->
    <div v-else class="mt-3 text-center">
      <p class="text-xs text-cinema-textMuted/70">
        Désolé, cette séance est complète
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from 'vue';
import type { Slot } from '../composables/useSlots';

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
