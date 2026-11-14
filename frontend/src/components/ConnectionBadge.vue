<template>
  <div
    role="status"
    :aria-label="`Statut de connexion réseau : ${statusLabel}`"
    class="inline-flex flex-row items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 whitespace-nowrap shrink-0"
    :class="statusBadgeClasses"
    :title="statusTooltip"
  >
    <!-- Pastille lumineuse d'état avec icône pour double encodage -->
    <span
      class="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold"
      :class="isOffline ? 'bg-amber-400 text-cinema-dark' : isReconnecting ? 'bg-blue-400 text-cinema-dark animate-spin' : 'bg-emerald-400 text-cinema-dark'"
      aria-hidden="true"
    >
      {{ isOffline ? '!' : isReconnecting ? '⟳' : '✓' }}
    </span>

    <!-- Libellé du statut -->
    <span class="font-medium tracking-wide shrink-0 leading-none">
      {{ statusLabel }}
    </span>

    <!-- Compteur d'opérations hors-ligne en attente -->
    <span
      v-if="pendingCount > 0"
      class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 leading-none"
      :aria-label="`${pendingCount} opérations en attente de synchronisation`"
    >
      {{ pendingCount }} en attente
    </span>

    <!-- Séparateur & Bouton de reconnexion manuelle si hors-ligne -->
    <template v-if="isOffline">
      <span class="w-px h-3 bg-amber-500/30 mx-0.5 shrink-0" aria-hidden="true"></span>
      <button
        @click="triggerManualReconnect"
        class="text-[11px] text-accent-gold hover:text-white transition-colors cursor-pointer font-semibold flex items-center gap-1 shrink-0 leading-none"
        aria-label="Tenter une reconnexion immédiate"
        title="Tenter une reconnexion immédiate"
      >
        <span>Réessayer</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConnection } from '../composables/useConnection';

const {
  isOnline,
  isOffline,
  isReconnecting,
  pendingCount,
  triggerManualReconnect,
} = useConnection();

const statusLabel = computed(() => {
  if (isReconnecting.value) return 'Synchronisation...';
  if (isOffline.value) return 'Mode hors-ligne';
  return 'En ligne';
});

const statusTooltip = computed(() => {
  if (isReconnecting.value) return 'Reconnexion et synchronisation des données avec le serveur';
  if (isOffline.value) return 'Le serveur est indisponible. Les données en cache sont affichées et vos actions seront synchronisées au retour.';
  return 'Connecté au serveur CinéSlot en temps réel';
});

const statusBadgeClasses = computed(() => {
  if (isReconnecting.value) {
    return 'bg-blue-950/60 text-blue-300 border-blue-500/40 shadow-sm';
  }
  if (isOffline.value) {
    return 'bg-amber-950/70 text-amber-300 border-amber-500/50 shadow-sm';
  }
  return 'bg-cinema-card/80 text-emerald-400 border-emerald-500/30';
});
</script>
