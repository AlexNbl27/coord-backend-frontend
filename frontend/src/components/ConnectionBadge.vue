<template>
  <div>
    <!-- Badge de statut réseau intégré (utilisable dans Navbar) -->
    <div
      class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-300"
      :class="statusBadgeClasses"
      :title="statusTooltip"
    >
      <!-- Pastille lumineuse d'état -->
      <span class="relative flex h-2 w-2">
        <span
          v-if="isOffline || isReconnecting"
          class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          :class="pingColorClass"
        ></span>
        <span
          class="relative inline-flex rounded-full h-2 w-2"
          :class="dotColorClass"
        ></span>
      </span>

      <!-- Libellé du statut -->
      <span class="font-medium tracking-wide">
        {{ statusLabel }}
      </span>

      <!-- Compteur d'opérations hors-ligne en attente -->
      <span
        v-if="pendingCount > 0"
        class="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30"
      >
        {{ pendingCount }} en attente
      </span>

      <!-- Bouton de reconnexion manuelle si hors-ligne -->
      <button
        v-if="isOffline"
        @click="triggerManualReconnect"
        class="ml-1 text-[11px] text-accent-gold hover:underline cursor-pointer font-bold"
        title="Tenter une reconnexion immédiate"
      >
        Réessayer
      </button>
    </div>

    <!-- Notification Toast Flottante Décorative -->
    <transition
      enter-active-class="transition duration-300 ease-out transform"
      leave-active-class="transition duration-200 ease-in transform"
      enter-from-class="opacity-0 translate-y-3 scale-95"
      leave-to-class="opacity-0 translate-y-2 scale-95"
    >
      <div
        v-if="activeToast"
        class="fixed bottom-6 right-6 z-50 max-w-md p-3.5 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-3"
        :class="toastClasses"
      >
        <span class="text-lg">{{ toastIcon }}</span>
        <div class="flex-1 pr-2">
          <p class="text-xs font-semibold leading-relaxed">{{ activeToast.message }}</p>
        </div>
        <button
          @click="clearToast"
          class="text-xs opacity-60 hover:opacity-100 transition-opacity p-1 cursor-pointer"
        >
          ✕
        </button>
      </div>
    </transition>
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
  activeToast,
  clearToast,
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

const toastIcon = computed(() => {
  if (!activeToast.value) return 'ℹ️';
  switch (activeToast.value.type) {
    case 'success': return '✓';
    case 'warning': return '⚠️';
    case 'error': return '✕';
    default: return 'ℹ️';
  }
});

const toastClasses = computed(() => {
  if (!activeToast.value) return '';
  switch (activeToast.value.type) {
    case 'success':
      return 'bg-emerald-950/90 text-emerald-100 border-emerald-500/50';
    case 'warning':
      return 'bg-amber-950/90 text-amber-100 border-amber-500/50';
    case 'error':
      return 'bg-red-950/90 text-red-100 border-red-500/50';
    default:
      return 'bg-cinema-card/95 text-white border-cinema-border';
  }
});
</script>
