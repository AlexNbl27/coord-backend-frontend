import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useConnectionStore } from '../stores/connection';
import { offlineQueue } from '../services/offlineQueue';
import axios from 'axios';

type SyncHook = () => Promise<void> | void;

const registeredSyncHooks = new Set<SyncHook>();
let isWatcherInitialized = false;
let healthCheckTimer: any = null;
let currentBackoffMs = 2000;
const MAX_BACKOFF_MS = 15000;

export function useConnection() {
  const connectionStore = useConnectionStore();

  const status = computed(() => connectionStore.status);
  const isOnline = computed(() => connectionStore.isOnline);
  const isOffline = computed(() => connectionStore.isOffline);
  const isReconnecting = computed(() => connectionStore.isReconnecting);
  const pendingCount = computed(() => connectionStore.pendingMutationsCount);
  const activeToast = computed(() => connectionStore.activeToast);

  /**
   * Enregistre un callback à invoquer lors du retour de la connexion
   */
  const onReconnectSync = (hook: SyncHook) => {
    registeredSyncHooks.add(hook);
    return () => registeredSyncHooks.delete(hook);
  };

  /**
   * Teste directement si le backend est joignable via /api/health ou /health
   */
  const checkBackendHealth = async (): Promise<boolean> => {
    try {
      const res = await axios.get('/api/health', {
        timeout: 4000,
        headers: { 'Cache-Control': 'no-cache' },
      });
      return res.status === 200;
    } catch {
      try {
        const fallback = await axios.get('/health', {
          timeout: 4000,
          headers: { 'Cache-Control': 'no-cache' },
        });
        return fallback.status === 200;
      } catch {
        return false;
      }
    }
  };

  /**
   * Boucle de Health Check avec Exponential Backoff + Jitter
   */
  const startHealthCheckLoop = () => {
    if (healthCheckTimer) return;

    const probe = async () => {
      const isHealthy = await checkBackendHealth();

      if (isHealthy) {
        console.log('[useConnection] Backend de retour ! Rétablissement de la connexion.');
        stopHealthCheckLoop();
        await handleReconnection();
      } else {
        // Exponential backoff
        currentBackoffMs = Math.min(currentBackoffMs * 1.5, MAX_BACKOFF_MS);
        const jitter = Math.floor(Math.random() * 500);
        const nextDelay = currentBackoffMs + jitter;
        healthCheckTimer = setTimeout(probe, nextDelay);
      }
    };

    // Premier essai rapide dans 1500ms
    currentBackoffMs = 2000;
    healthCheckTimer = setTimeout(probe, 1500);
  };

  const stopHealthCheckLoop = () => {
    if (healthCheckTimer) {
      clearTimeout(healthCheckTimer);
      healthCheckTimer = null;
    }
    currentBackoffMs = 2000;
  };

  /**
   * Gère la reprise après coupure : vidage de la queue et synchronisation des données
   */
  const handleReconnection = async () => {
    connectionStore.setReconnecting();

    try {
      // 1. Vider la file d'attente hors-ligne
      await offlineQueue.processQueue();

      // 2. Notifier tous les composables enregistrés (rafraîchir séances, films, SSE)
      for (const hook of registeredSyncHooks) {
        try {
          await hook();
        } catch (e) {
          console.error('[useConnection] Erreur dans hook de synchronisation:', e);
        }
      }

      // 3. Basculer l'état à ONLINE
      connectionStore.setOnline();
    } catch (err) {
      console.error('[useConnection] Erreur lors de la reconnexion:', err);
      // En cas d'échec, reprendre la boucle de health check
      startHealthCheckLoop();
    }
  };

  /**
   * Initialise les écouteurs globaux du navigateur et surveille l'état
   */
  const initConnectionWatcher = () => {
    if (isWatcherInitialized) return;
    isWatcherInitialized = true;

    window.addEventListener('online', async () => {
      console.log('[useConnection] Événement réseau navigateur: ONLINE');
      const isBackendUp = await checkBackendHealth();
      if (isBackendUp) {
        await handleReconnection();
      } else {
        connectionStore.setOffline();
        startHealthCheckLoop();
      }
    });

    window.addEventListener('offline', () => {
      console.warn('[useConnection] Événement réseau navigateur: OFFLINE');
      connectionStore.setOffline();
      startHealthCheckLoop();
    });

    // Surveillance réactive du store
    connectionStore.$subscribe((mutation, state) => {
      if (state.status === 'OFFLINE') {
        startHealthCheckLoop();
      } else if (state.status === 'ONLINE') {
        stopHealthCheckLoop();
      }
    });
  };

  return {
    status,
    isOnline,
    isOffline,
    isReconnecting,
    pendingCount,
    activeToast,
    clearToast: connectionStore.clearToast,
    initConnectionWatcher,
    onReconnectSync,
    checkBackendHealth,
    triggerManualReconnect: handleReconnection,
  };
}
