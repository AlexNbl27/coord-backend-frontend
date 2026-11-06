import { computed, ref } from 'vue';
import { apiClient } from '../services/apiClient';

export type UserRole = 'SUPER_ADMIN' | 'CINEMA_ADMIN' | 'SPECTATOR';

export interface SpectatorUser {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  cinemaSlugs?: string[];
}

const currentUser = ref<SpectatorUser | null>(null);
const googleEnabled = ref(false);
let initPromise: Promise<void> | null = null;
const isSuperAdmin = computed(() => currentUser.value?.role === 'SUPER_ADMIN');

const REQUEST_OPTIONS = { withCredentials: true, skipOfflineTrigger: true };

function apiErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (err?.response?.status === 429) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  return data?.detail || data?.message || 'Le service est momentanément indisponible.';
}

export function useSession() {
  const initSession = () => {
    initPromise ??= apiClient
      .get<{ authenticated: boolean; user: SpectatorUser | null; googleEnabled?: boolean }>('/api/session', REQUEST_OPTIONS)
      .then((response) => {
        currentUser.value = response.data.authenticated ? response.data.user : null;
        googleEnabled.value = Boolean(response.data.googleEnabled);
      })
      .catch(() => {
        // Hors-ligne ou tests unitaires : on reste anonyme
      });
    return initPromise;
  };

  // Chaque action renvoie null si OK, sinon le message d'erreur à afficher
  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const response = await apiClient.post<{ user: SpectatorUser }>('/api/session/login', { email, password }, REQUEST_OPTIONS);
      currentUser.value = response.data.user;
      return null;
    } catch (err) {
      return apiErrorMessage(err);
    }
  };

  const register = async (email: string, name: string, password: string): Promise<string | null> => {
    try {
      const response = await apiClient.post<{ user: SpectatorUser }>('/api/session/register', { email, name, password }, REQUEST_OPTIONS);
      currentUser.value = response.data.user;
      return null;
    } catch (err) {
      return apiErrorMessage(err);
    }
  };

  const forgotPassword = async (email: string): Promise<string | null> => {
    try {
      await apiClient.post('/api/session/forgot-password', { email }, REQUEST_OPTIONS);
      return null;
    } catch (err) {
      return apiErrorMessage(err);
    }
  };

  const resetPassword = async (token: string, password: string): Promise<string | null> => {
    try {
      await apiClient.post('/api/session/reset-password', { token, password }, REQUEST_OPTIONS);
      return null;
    } catch (err) {
      return apiErrorMessage(err);
    }
  };

  const logout = async () => {
    sessionStorage.setItem('cineslot_logged_out', '1');
    try {
      await apiClient.post('/api/session/logout', {}, REQUEST_OPTIONS);
    } finally {
      currentUser.value = null;
    }
  };

  return {
    currentUser,
    isSuperAdmin,
    googleEnabled,
    initSession,
    login,
    register,
    forgotPassword,
    resetPassword,
    logout
  };
}
