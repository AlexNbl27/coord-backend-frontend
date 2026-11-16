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

  let offlineDebounceTimer: any = null;
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

  const setOnline = () => {
    if (offlineDebounceTimer) {
      clearTimeout(offlineDebounceTimer);
      offlineDebounceTimer = null;
    }

    if (status.value !== 'ONLINE') {
      status.value = 'ONLINE';
      lastSyncTime.value = Date.now();
    }
  };

  const setOffline = (immediate = false) => {
    if (status.value === 'OFFLINE') return;

    if (immediate) {
      if (offlineDebounceTimer) clearTimeout(offlineDebounceTimer);
      status.value = 'OFFLINE';
      return;
    }

    if (!offlineDebounceTimer) {
      offlineDebounceTimer = setTimeout(() => {
        offlineDebounceTimer = null;
        if (status.value !== 'OFFLINE') {
          status.value = 'OFFLINE';
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
