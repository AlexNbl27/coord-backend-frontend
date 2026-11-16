import axios, { AxiosError } from 'axios';
import { useConnectionStore } from '../stores/connection';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retryCount?: number;
    skipRetry?: boolean;
    skipOfflineTrigger?: boolean;
  }
}

/**
 * Centralized HTTP client with 2s timeout, single fast retry on 5xx GET requests,
 * and automatic online/offline connection state updates.
 */
export const apiClient = axios.create({
  adapter: 'fetch',
  timeout: 2000,
  withCredentials: true,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    if (!config.headers['X-Request-Id']) {
      config.headers['X-Request-Id'] =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 10);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => {
    try {
      const connectionStore = useConnectionStore();
      connectionStore.setOnline();
    } catch {
      // Pinia store not initialized yet
    }
    return response;
  },
  async (error: AxiosError) => {
    if (axios.isCancel(error) || error.name === 'CanceledError' || error.name === 'AbortError') {
      return Promise.reject(error);
    }

    const config = error.config;
    const isNetworkError = !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
    const isServerError = !!error.response && error.response.status >= 500;

    // Retry once on transient 5xx GET errors; skip network timeouts to fail fast
    if (config && !config.skipRetry && config.method?.toUpperCase() === 'GET') {
      const currentRetry = config._retryCount || 0;
      const maxRetries = 1;

      if (currentRetry < maxRetries && isServerError && !isNetworkError) {
        config._retryCount = currentRetry + 1;
        await new Promise((resolve) => setTimeout(resolve, 250));
        return apiClient(config);
      }
    }

    if ((isNetworkError || isServerError) && (!config || !config.skipOfflineTrigger)) {
      try {
        const connectionStore = useConnectionStore();
        connectionStore.setOffline(false);
      } catch {
        // Pinia store not initialized yet
      }
    }

    // Session absente ou expirée : redirection vers la page de connexion
    if (error.response?.status === 401 && !config?.url?.startsWith('/api/session')) {
      void import('../router').then(({ default: router }) => {
        const current = router.currentRoute.value;
        if (current.name !== 'login') {
          void router.push({ name: 'login', query: { redirect: current.fullPath } });
        }
      });
    }

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
