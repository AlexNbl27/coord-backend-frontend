<template>
  <div class="fixed bottom-4 right-4 z-50">
    <div
      role="status"
      :aria-label="sseConnected ? 'Synchronisation SSE en direct active' : 'Flux SSE en direct déconnecté'"
      class="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full backdrop-blur-md bg-cinema-card/95 border border-cinema-border shadow-lg transition-all"
    >
      <!-- Indicateur double encodé (couleur + icône) -->
      <span
        class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
        :class="sseConnected ? 'bg-emerald-500 text-cinema-dark shadow-sm' : 'bg-red-500 text-white animate-pulse'"
        aria-hidden="true"
      >
        {{ sseConnected ? '✓' : '!' }}
      </span>

      <!-- Texte de statut -->
      <span
        class="text-xs font-semibold"
        :class="sseConnected ? 'text-emerald-400' : 'text-red-400'"
      >
        {{ sseConnected ? 'En direct' : (reconnecting ? 'Reconnexion...' : 'Déconnecté') }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSlots } from '../composables/useSlots';

const { sseConnected, connectSse, disconnectSse } = useSlots();

const reconnecting = ref(false);

const reconnect = () => {
  reconnecting.value = true;
  disconnectSse();
  
  setTimeout(() => {
    connectSse();
    reconnecting.value = false;
  }, 3000);
};

watch(sseConnected, (connected) => {
  if (!connected && !reconnecting.value) {
    reconnect();
  }
});
</script>
