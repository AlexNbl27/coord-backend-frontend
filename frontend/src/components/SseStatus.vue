<template>
  <div class="fixed bottom-4 right-4 z-50">
    <div
      class="flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md bg-white/10 border border-white/20 shadow-lg"
      :class="{
        'opacity-100': showStatus,
        'opacity-0 pointer-events-none': !showStatus
      }"
      @mouseenter="showStatus = true"
      @mouseleave="showStatus = false"
    >
      <!-- Indicateur de connexion -->
      <div
        class="w-3 h-3 rounded-full transition-all duration-300"
        :class="{
          'bg-green-500 shadow-gold': sseConnected,
          'bg-red-500 animate-pulse': !sseConnected
        }"
      ></div>
      
      <!-- Texte de statut -->
      <Transition name="fade" mode="out-in">
        <span
          v-if="sseConnected"
          key="connected"
          class="text-sm font-medium text-green-400"
        >
          Connexion SSE active
        </span>
        <span
          v-else
          key="disconnected"
          class="text-sm font-medium text-red-400"
        >
          {{ reconnecting ? 'Reconnexion...' : 'SSE déconnecté' }}
        </span>
      </Transition>
      
      <!-- Icône de synchronization -->
      <div
        v-if="sseConnected"
        class="text-accent-gold"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useSlotsStore } from '../stores/slots';
import { useSlots } from '../composables/useSlots';

const slotsStore = useSlotsStore();
const { sseConnected, connectSse, disconnectSse } = useSlots();

const showStatus = ref(false);
const reconnecting = ref(false);

// Synchroniser le store avec le composable
onMounted(() => {
  // Mettre à jour le store quand sseConnected change
  const unsubscribe = slotsStore.$subscribe((mutation, state) => {
    if (mutation.events.key === 'sseConnected') {
      // Si déconnecté, tenter de se reconnecter
      if (!state.sseConnected && !reconnecting.value) {
        reconnect();
      }
    }
  });

  onUnmounted(() => {
    unsubscribe();
  });
});

// Fonction de reconnexion automatique
const reconnect = () => {
  reconnecting.value = true;
  disconnectSse();
  
  setTimeout(() => {
    connectSse();
    reconnecting.value = false;
  }, 3000);
};

// Exposer sseConnected pour le template
expose({ sseConnected });
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}
</style>
