<template>
  <div class="min-h-screen">
    <!-- En-tête -->
    <section class="py-12 px-4 sm:px-6 lg:px-8">
      <div class="page-container">
        <h1 class="section-title">🎟️ Toutes les séances</h1>
        <p class="section-subtitle">Réservez en temps réel avec synchronisation SSE</p>
      </div>
    </section>

    <!-- Filtres -->
    <section class="section">
      <div class="page-container">
        <div class="flex flex-wrap gap-2 mb-6">
          <button
            @click="filterSlots('ALL')"
            class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
            :class="{
              'bg-accent-gold text-cinema-dark': selectedFilter === 'ALL',
              'bg-cinema-card text-cinema-textMuted border border-cinema-border': selectedFilter !== 'ALL'
            }"
          >
            Toutes ({{ totalSlots }})
          </button>
          <button
            @click="filterSlots('AVAILABLE')"
            class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
            :class="{
              'bg-green-600 text-white': selectedFilter === 'AVAILABLE',
              'bg-cinema-card text-cinema-textMuted border border-cinema-border': selectedFilter !== 'AVAILABLE'
            }"
          >
            Disponibles ({{ availableSlotsCount }})
          </button>
          <button
            @click="filterSlots('BOOKED')"
            class="px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
            :class="{
              'bg-red-600 text-white': selectedFilter === 'BOOKED',
              'bg-cinema-card text-cinema-textMuted border border-cinema-border': selectedFilter !== 'BOOKED'
            }"
          >
            Complètes ({{ bookedSlotsCount }})
          </button>
        </div>

        <!-- Indicateur SSE -->
        <div class="mb-6 p-4 rounded-lg border border-cinema-border/50 bg-cinema-card/50">
          <div class="flex items-center gap-3">
            <div
              class="w-3 h-3 rounded-full transition-all duration-300"
              :class="{
                'bg-green-500': sseConnected,
                'bg-red-500 animate-pulse': !sseConnected
              }"
            ></div>
            <div>
              <h3 class="text-white font-semibold">Statut de la connexion SSE</h3>
              <p class="text-sm text-cinema-textMuted">
                {{ sseConnected 
                  ? 'Connexion établie. Les mises à jour des séances sont synchronisées en temps réel.'
                  : 'Connexion en cours... Les séances seront mises à jour automatiquement.'
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Séances -->
        <div v-if="loading" class="slots-grid">
          <div v-for="n in 12" :key="n" class="skeleton h-40 rounded-lg"></div>
        </div>
        <div v-else-if="displayedSlots.length === 0" class="empty-state">
          <div class="empty-state-icon">🎬</div>
          <p class="empty-state-text">Aucune séance trouvée avec ces critères.</p>
          <button @click="generateDemoSlot" class="mt-4 btn btn-primary" :disabled="!sseConnected">
            Générer une séance
          </button>
        </div>
        <div v-else class="slots-grid">
          <SlotCard
            v-for="slot in displayedSlots"
            :key="slot.id"
            :slot="slot"
            :sse-connected="sseConnected"
            @reserve="handleReserve"
            @click="selectSlot(slot)"
          />
        </div>
      </div>
    </section>

    <!-- Modal de détails de séance -->
    <Transition name="modal">
      <div v-if="selectedSlot" class="modal-overlay" @click.self="selectedSlot = null">
        <div class="modal-content max-w-lg w-full mx-4">
          <button @click="selectedSlot = null" class="modal-close">&times;</button>
          
          <div class="text-center">
            <h2 class="text-2xl font-bold text-white mb-2">{{ selectedSlot.movieTitle }}</h2>
            <p class="text-cinema-textMuted mb-4">{{ selectedSlot.hall }}</p>
            
            <div class="space-y-4 mb-6">
              <div class="flex justify-between items-center p-3 bg-cinema-card/50 rounded-lg">
                <div class="flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-cinema-textMuted" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-white">{{ formattedStartsAt }}</span>
                </div>
                <span
                  class="badge whitespace-nowrap"
                  :class="{
                    'badge-available': selectedSlot.status === 'AVAILABLE',
                    'badge-booked': selectedSlot.status === 'BOOKED'
                  }"
                >
                  {{ selectedSlot.status === 'AVAILABLE' ? 'Disponible' : 'Complet' }}
                </span>
              </div>
            </div>

            <!-- Actions -->
            <div v-if="selectedSlot.status === 'AVAILABLE' && sseConnected" class="flex gap-4">
              <button
                @click="handleReserve(selectedSlot.id, generateCustomerId())"
                class="flex-1 btn btn-primary"
                :disabled="isReserving"
              >
                <span v-if="!isReserving">Réserver maintenant</span>
                <span v-else class="flex items-center justify-center gap-2">
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Réservation...
                </span>
              </button>
            </div>
            
            <button @click="selectedSlot = null" class="mt-4 w-full btn btn-outline">
              Fermer
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useSlotsStore } from '../stores/slots';
import { useSlots } from '../composables/useSlots';
import SlotCard from '../components/SlotCard.vue';
import type { Slot } from '../composables/useSlots';

const slotsStore = useSlotsStore();
const { fetchSlots, reserveSlot, generateDemoSlot, sseConnected, availableSlots, bookedSlots } = useSlots();

// État
const loading = ref(false);
const selectedFilter = ref<'ALL' | 'AVAILABLE' | 'BOOKED'>('ALL');
const selectedSlot = ref<Slot | null>(null);
const isReserving = ref(false);

// Séances calculées
const allSlots = computed(() => [
  ...availableSlots.value,
  ...bookedSlots.value
]);

const totalSlots = computed(() => allSlots.value.length);
const availableSlotsCount = computed(() => availableSlots.value.length);
const bookedSlotsCount = computed(() => bookedSlots.value.length);

// Séances affichées (filtrées)
const displayedSlots = computed(() => {
  switch (selectedFilter.value) {
    case 'AVAILABLE':
      return availableSlots.value;
    case 'BOOKED':
      return bookedSlots.value;
    default:
      return allSlots.value;
  }
});

// Filtrer les séances
const filterSlots = (filter: 'ALL' | 'AVAILABLE' | 'BOOKED') => {
  selectedFilter.value = filter;
};

// Sélectionner une séance
const selectSlot = (slot: Slot) => {
  selectedSlot.value = slot;
};

// Gérer la réservation
const handleReserve = async (slotId: string, customerId: string) => {
  if (!sseConnected.value) return;
  
  isReserving.value = true;
  
  try {
    const result = await reserveSlot(slotId, customerId);
    
    // Ouvrir le modal de confirmation
    const openReservationModal = inject<(bookingId: string, movieTitle: string, startsAt: string, hall: string) => void>('openReservationModal');
    const slot = allSlots.value.find(s => s.id === slotId);
    if (slot && openReservationModal) {
      openReservationModal(
        result.bookingId,
        slot.movieTitle,
        slot.startsAt,
        slot.hall
      );
    }
    
    // Fermer le modal de détails
    selectedSlot.value = null;
    
  } catch (err) {
    console.error('Erreur lors de la réservation:', err);
  } finally {
    isReserving.value = false;
  }
};

// Générer un ID client aléatoire
const generateCustomerId = () => {
  return `user-${Math.random().toString(36).substring(2, 9)}-${Date.now()}`;
};

// Formater la date
const formattedStartsAt = computed(() => {
  if (!selectedSlot.value) return '';
  const date = new Date(selectedSlot.value.startsAt);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});

// Charger les séances au montage
import { onMounted, inject } from 'vue';

onMounted(async () => {
  loading.value = true;
  try {
    await fetchSlots();
  } catch (err) {
    console.error('Erreur lors du chargement des séances:', err);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* Animation pour les cartes */
.slot-card {
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Skeleton animation */
.skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.modal-enter-to,
.modal-leave-from {
  opacity: 1;
  transform: scale(1);
}
</style>
