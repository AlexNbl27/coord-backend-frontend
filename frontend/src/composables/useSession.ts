import { computed, ref } from 'vue';
import { apiClient } from '../services/apiClient';
import { currentHostContext } from '../services/tenant';

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
const mfaEnabled = ref(false);
const mfaVerifiedAt = ref<number | null>(null);
let initPromise: Promise<void> | null = null;
const isSuperAdmin = computed(() => currentUser.value?.role === 'SUPER_ADMIN');
const isAdmin = computed(() => isSuperAdmin.value || currentUser.value?.role === 'CINEMA_ADMIN');

function isAdminPlane(): boolean {
  try {
    return currentHostContext().plane === 'admin';
  } catch {
    return false;
  }
}

const REQUEST_OPTIONS = { withCredentials: true, skipOfflineTrigger: true };

function apiErrorMessage(err: any): string {
  const data = err?.response?.data;
  if (err?.response?.status === 429) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  return data?.detail || data?.message || 'Le service est momentanément indisponible.';
}

export function useSession() {
  const adminPlane = isAdminPlane();

  const initSession = () => {
    const endpoint = adminPlane ? '/api/admin/session' : '/api/session';
    initPromise ??= apiClient
      .get<{ authenticated: boolean; user: SpectatorUser | null; googleEnabled?: boolean; mfaVerifiedAt?: number | null }>(endpoint, REQUEST_OPTIONS)
      .then((response) => {
        currentUser.value = response.data.authenticated ? response.data.user : null;
        googleEnabled.value = adminPlane ? false : Boolean(response.data.googleEnabled);
        mfaVerifiedAt.value = adminPlane ? (response.data.mfaVerifiedAt ?? null) : null;
      })
      .catch(() => {
        // Hors-ligne ou tests unitaires : on reste anonyme
      });
    return initPromise;
  };

  // Chaque action renvoie null si OK, sinon le message d'erreur à afficher
  const login = async (email: string, password: string, totpCode?: string): Promise<string | null> => {
    try {
      if (adminPlane) {
        const response = await apiClient.post<{ user: SpectatorUser; mfaEnabled?: boolean; mfaVerifiedAt?: number | null }>(
          '/api/admin/session/login',
          { email, password, ...(totpCode ? { totpCode } : {}) },
          REQUEST_OPTIONS
        );
        currentUser.value = response.data.user;
        mfaEnabled.value = Boolean(response.data.mfaEnabled);
        mfaVerifiedAt.value = response.data.mfaVerifiedAt ?? null;
        return null;
      }
      const response = await apiClient.post<{ user: SpectatorUser }>('/api/session/login', { email, password }, REQUEST_OPTIONS);
      currentUser.value = response.data.user;
      return null;
    } catch (err) {
      return apiErrorMessage(err);
    }
  };

  const setupMfa = async (): Promise<{ secret: string; otpauthUri: string } | string> => {
    try {
      const response = await apiClient.post<{ secret: string; otpauthUri: string }>('/api/admin/session/mfa/setup', {}, REQUEST_OPTIONS);
      return response.data;
    } catch (err) {
      return apiErrorMessage(err);
    }
  };

  const verifyMfa = async (code: string): Promise<string | null> => {
    try {
      const response = await apiClient.post<{ mfaVerifiedAt: number }>('/api/admin/session/mfa/verify', { code }, REQUEST_OPTIONS);
      mfaEnabled.value = true;
      mfaVerifiedAt.value = response.data.mfaVerifiedAt;
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
      await apiClient.post(adminPlane ? '/api/admin/session/logout' : '/api/session/logout', {}, REQUEST_OPTIONS);
    } finally {
      currentUser.value = null;
      mfaEnabled.value = false;
      mfaVerifiedAt.value = null;
    }
  };

  return {
    currentUser,
    isSuperAdmin,
    isAdmin,
    isAdminPlane: adminPlane,
    googleEnabled,
    mfaEnabled,
    mfaVerifiedAt,
    initSession,
    login,
    setupMfa,
    verifyMfa,
    register,
    forgotPassword,
    resetPassword,
    logout
  };
}
