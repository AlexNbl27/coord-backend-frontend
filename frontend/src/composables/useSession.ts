import { ref } from 'vue';
import { apiClient } from '../services/apiClient';

export interface SpectatorUser {
  id: string;
  name: string;
  email: string;
}

const DEFAULT_DEMO_USERS: SpectatorUser[] = [
  { id: 'spectator-1', name: 'Hélène Durand', email: 'helene.durand@cineslot.test' },
  { id: 'spectator-2', name: 'Lucas Martin', email: 'lucas.martin@cineslot.test' }
];

const currentUser = ref<SpectatorUser | null>(DEFAULT_DEMO_USERS[0]);
const demoUsers = ref<SpectatorUser[]>(DEFAULT_DEMO_USERS);
const initialized = ref(false);

export function useSession() {
  const initSession = async () => {
    if (initialized.value) return;
    initialized.value = true;
    try {
      const response = await apiClient.get<{
        authenticated: boolean;
        user: SpectatorUser | null;
        demoUsers?: SpectatorUser[];
      }>('/api/session', {
        withCredentials: true,
        skipOfflineTrigger: true
      });

      if (response.data.demoUsers?.length) {
        demoUsers.value = response.data.demoUsers;
      }

      if (response.data.authenticated && response.data.user) {
        currentUser.value = response.data.user;
      } else {
        await switchUser('spectator-1');
      }
    } catch {
      // Keep default demo user state in offline or unit-test environments
    }
  };

  const switchUser = async (userId: string) => {
    if (userId === 'anonymous') {
      await logout();
      return;
    }

    try {
      const response = await apiClient.post<{ authenticated: boolean; user: SpectatorUser }>(
        '/api/session/login',
        { userId },
        { withCredentials: true, skipOfflineTrigger: true }
      );
      currentUser.value = response.data.user;
    } catch {
      const localMatch = demoUsers.value.find((u) => u.id === userId) ?? null;
      currentUser.value = localMatch;
    }
  };

  const logout = async () => {
    try {
      await apiClient.post('/api/session/logout', {}, { withCredentials: true, skipOfflineTrigger: true });
    } finally {
      currentUser.value = null;
    }
  };

  return {
    currentUser,
    demoUsers,
    initSession,
    switchUser,
    logout
  };
}
