import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useConnectionStore } from '../stores/connection';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retryCount?: number;
    skipRetry?: boolean;
    skipOfflineTrigger?: boolean;
  }
}

/**
 * Client HTTP centralisé avec politique de résilience :
 * - Timeout configuré à 8 secondes
 * - Retry automatique avec Exponential Backoff + Jitter sur requêtes GET en cas de micro-coupure
 * - Notification automatique de l'état de connexion (Online / Offline)
 */
export const apiClient = axios.create({
  adapter: 'fetch',
  timeout: 2000,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
  },
});

// Intercepteur Requête : Génération d'un Id de corrélation
apiClient.interceptors.request.use(
  (config) => {
    if (!config.headers['X-Request-Id']) {
      config.headers['X-Request-Id'] = Math.random().toString(36).substring(2, 10);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Intercepteur Réponse : Gestion de la résilience, retry et bascule d'état
apiClient.interceptors.response.use(
  (response) => {
    try {
      const connectionStore = useConnectionStore();
      connectionStore.setOnline();
    } catch {
      // Ignorer si le store n'est pas encore disponible
    }
    return response;
  },
  async (error: AxiosError) => {
    // Si la requête a été volontairement annulée par AbortController, ne pas la considérer comme panne
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
      return Promise.reject(error);
    }

    const config = error.config;
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
    const isServerError = !!error.response && error.response.status >= 500;

    // 1. Stratégie de retry automatique rapide UNIQUEMENT sur erreur serveur temporaire (502/503/504)
    // Ne JAMAIS rejouer sur timeout de connexion ou réseau mort (isNetworkError) pour éviter d'allonger le temps d'attente
    if (config && !config.skipRetry && (config.method?.toUpperCase() === 'GET')) {
      const currentRetry = config._retryCount || 0;
      const maxRetries = 1; // 1 retry rapide

      if (currentRetry < maxRetries && isServerError && !isNetworkError) {
        config._retryCount = currentRetry + 1;
        const delay = 250;
        console.warn(`[apiClient] Tentative de rejeu rapide ${config._retryCount}/${maxRetries} pour ${config.url} dans ${delay}ms`);

        await new Promise((resolve) => setTimeout(resolve, delay));
        return apiClient(config);
      }
    }

    // 2. Détection de déconnexion du backend UNIQUEMENT si les retries ont tous échoué
    if ((isNetworkError || isServerError) && (!config || !config.skipOfflineTrigger)) {
      try {
        const connectionStore = useConnectionStore();
        connectionStore.setOffline(false); // Mode debounced pour éviter tout clignotement
      } catch {
        // Pinia pas encore initialisé
      }
    }

    // 3. Corrélation d'erreur : attacher l'identifiant de trace (X-Trace-Id) au message d'erreur
    const traceId = error.response?.headers?.['x-trace-id'];
    if (traceId && typeof error.message === 'string' && !error.message.includes(traceId)) {
      const data = error.response?.data as { message?: string } | undefined;
      if (data && typeof data.message === 'string' && !data.message.includes(traceId)) {
        data.message = `${data.message} (réf. ${traceId})`;
      }
      error.message = `${error.message} (réf. ${traceId})`;
    }

    return Promise.reject(error);
  }
);
