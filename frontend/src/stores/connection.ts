import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export type ConnectionStatus = 'ONLINE' | 'RECONNECTING' | 'OFFLINE';

export interface ToastNotification {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
}

export const useConnectionStore = defineStore('connection', () => {
  const status = ref<ConnectionStatus>('ONLINE');
  const pendingMutationsCount = ref(0);
  const lastSyncTime = ref<number | null>(Date.now());
  const activeToast = ref<ToastNotification | null>(null);

  // Timers pour l'anti-flapping (éviter les flashs de popup)
  let offlineDebounceTimer: any = null;
  let offlineStartTime: number | null = null;
  let toastTimeout: any = null;

  const isOnline = computed(() => status.value === 'ONLINE');
  const isOffline = computed(() => status.value === 'OFFLINE');
  const isReconnecting = computed(() => status.value === 'RECONNECTING');

  const showToast = (message: string, type: 'success' | 'warning' | 'info' | 'error' = 'info', durationMs = 3500) => {
    if (toastTimeout) {
      clearTimeout(toastTimeout);
    }
    activeToast.value = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
    };
    toastTimeout = setTimeout(() => {
      activeToast.value = null;
    }, durationMs);
  };

  const clearToast = () => {
    if (toastTimeout) clearTimeout(toastTimeout);
    activeToast.value = null;
  };

  /**
   * Bascule en ligne : annule tout passage en hors-ligne en cours
   * N'affiche un toast que si l'application a réellement été coupée pendant un temps significatif
   */
  const setOnline = () => {
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }

    if (status.value !== 'ONLINE') {
      const wasTrulyOffline = (status.value === 'OFFLINE' || status.value === 'RECONNECTING') &&
        offlineStartTime && (Date.now() - offlineStartTime > 2500);

      status.value = 'ONLINE';
      lastSyncTime.value = Date.now();
      offlineStartTime = null;

      // Uniquement si on était réellement en coupure avérée, notification discrète de succès
      if (wasTrulyOffline) {
        showToast('Connexion rétablie · Données synchronisées', 'success', 3000);
      }
    }
  };

  /**
   * Enregistre un échec réseau avec debounce anti-flapping (1,5 seconde)
   * Pas de popup intempestive : mise à jour silencieuse du statut dans la navbar
   */
  const setOffline = (immediate = false) => {
    if (status.value === 'OFFLINE') return;

    if (immediate) {
      if (offlineDebounceTimer) clearTimeout(offlineDebounceTimer);
      status.value = 'OFFLINE';
      offlineStartTime = Date.now();
      return;
    }

    if (!offlineDebounceTimer) {
      offlineDebounceTimer = setTimeout(() => {
        offlineDebounceTimer = null;
        if (status.value !== 'OFFLINE') {
          status.value = 'OFFLINE';
          offlineStartTime = Date.now();
          // Note UX : Nous n'affichons volontairement PAS de popup invasive ici !
          // Le badge discret dans la barre de navigation suffit amplement pour informer l'utilisateur.
        }
      }, 1500);
    }
  };

  const setReconnecting = () => {
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }
    status.value = 'RECONNECTING';
  };

  const setPendingMutationsCount = (count: number) => {
    pendingMutationsCount.value = count;
  };

  return {
    status,
    isOnline,
    isOffline,
    isReconnecting,
    pendingMutationsCount,
    lastSyncTime,
    activeToast,
    setOnline,
    setOffline,
    setReconnecting,
    setPendingMutationsCount,
    showToast,
    clearToast,
  };
});
