<template>
  <!-- Badge de statut réseau intégré dans la barre de navigation -->
  <div
    class="inline-flex flex-row items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300 whitespace-nowrap shrink-0"
    :class="statusBadgeClasses"
    :title="statusTooltip"
    style="display: inline-flex !important; flex-direction: row !important; align-items: center !important; white-space: nowrap !important;"
  >
    <!-- Pastille lumineuse d'état -->
    <span class="relative flex h-2 w-2 shrink-0">
      <span
        v-if="isOffline || isReconnecting"
        class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        :class="pingColorClass"
      ></span>
      <span
        class="relative inline-flex rounded-full h-2 w-2 shrink-0"
        :class="dotColorClass"
      ></span>
    </span>

    <!-- Libellé du statut -->
    <span class="font-medium tracking-wide shrink-0 leading-none">
      {{ statusLabel }}
    </span>

    <!-- Compteur d'opérations hors-ligne en attente -->
    <span
      v-if="pendingCount > 0"
      class="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 leading-none"
    >
      {{ pendingCount }} en attente
    </span>

    <!-- Séparateur & Bouton de reconnexion manuelle si hors-ligne -->
    <template v-if="isOffline">
      <span class="w-px h-3 bg-amber-500/30 mx-0.5 shrink-0"></span>
      <button
        @click="triggerManualReconnect"
        class="text-[11px] text-accent-gold hover:text-white transition-colors cursor-pointer font-semibold flex items-center gap-1 shrink-0 leading-none"
        title="Tenter une reconnexion immédiate"
      >
        <span>🔄</span>
        <span>Réessayer</span>
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useConnection } from '../composables/useConnection';

const {
  status,
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

const dotColorClass = computed(() => {
  if (isReconnecting.value) return 'bg-blue-400';
  if (isOffline.value) return 'bg-amber-400';
  return 'bg-emerald-400';
});

const pingColorClass = computed(() => {
  if (isReconnecting.value) return 'bg-blue-400';
  return 'bg-amber-400';
});
</script>
