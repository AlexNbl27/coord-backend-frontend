<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="close">
      <div class="modal-content relative max-w-md w-full mx-4">
        <!-- Close button -->
        <button
          @click="close"
          class="modal-close hover:text-accent-red transition-colors duration-200"
          aria-label="Fermer"
        >
          &times;
        </button>

        <!-- Success icon -->
        <div class="text-center mb-6">
          <div class="w-20 h-20 mx-auto mb-4 rounded-full bg-green-600/20 border-2 border-green-500/30 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
          </div>
          
          <h2 class="text-2xl font-bold text-white mb-2">
            Réservation confirmée !
          </h2>
          
          <p class="text-cinema-textMuted">
            Votre place a été réservée avec succès.
          </p>
        </div>

        <!-- Reservation details -->
        <div class="space-y-4 mb-8">
          <div class="bg-cinema-card/50 p-4 rounded-lg border border-cinema-border/50">
            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-cinema-textMuted text-sm">ID de réservation</span>
                <span class="text-white font-mono text-sm bg-accent-gold/20 px-2 py-1 rounded">{{ bookingId }}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="text-cinema-textMuted text-sm">Film</span>
                <span class="text-white font-medium">{{ movieTitle }}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="text-cinema-textMuted text-sm">Séance</span>
                <span class="text-white font-medium">{{ formattedStartsAt }}</span>
              </div>
              
              <div class="flex justify-between items-center">
                <span class="text-cinema-textMuted text-sm">Salle</span>
                <span class="text-white font-medium">{{ hall }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-4">
          <button
            @click="copyToClipboard"
            class="flex-1 btn btn-outline"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M8 4a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M8 6a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M8 8a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M8 10a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M8 12a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M8 14a1 1 0 000 2h2a1 1 0 100-2H8z" />
              <path d="M8 16a1 1 0 000 2h2a1 1 0 100-2H8z" />
            </svg>
            Copier l'ID
          </button>
          
          <button
            @click="close"
            class="flex-1 btn btn-primary"
          >
            Fermer
          </button>
        </div>

        <!-- Toast notification -->
        <Transition name="toast">
          <div
            v-if="copied"
            class="absolute -bottom-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
          >
            ID copié dans le presse-papiers !
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  show: boolean;
  bookingId: string;
  movieTitle: string;
  startsAt: string;
  hall: string;
}>();

const emit = defineEmits(['close']);

const copied = ref(false);

const close = () => {
  emit('close');
  copied.value = false;
};

// Formater la date de la séance
const formattedStartsAt = computed(() => {
  const date = new Date(props.startsAt);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
});

// Copier l'ID dans le presse-papiers
const copyToClipboard = async () => {
  try {
    await navigator.clipboard.writeText(props.bookingId);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Impossible de copier dans le presse-papiers:', err);
  }
};
</script>

<style scoped>
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

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(10px) translateX(-50%);
}

.toast-enter-to,
.toast-leave-from {
  opacity: 1;
  transform: translateY(0) translateX(-50%);
}
</style>
