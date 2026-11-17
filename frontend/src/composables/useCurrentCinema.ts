import { ref, computed } from 'vue';
import { apiClient } from '../services/apiClient';
import { currentHostContext } from '../services/tenant';

export type CinemaStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';

export interface CurrentCinema {
  slug: string;
  name: string;
  address: string;
  city: string;
  status: CinemaStatus;
}

const cinema = ref<CurrentCinema | null>(null);
const status = ref<CinemaStatus | null>(null);
let pending: Promise<CurrentCinema | null> | null = null;

const cinemaDisabled = computed(() => status.value !== null && status.value !== 'ACTIVE');
const cinemaLabel = computed(() => (cinema.value ? `${cinema.value.name} · ${cinema.value.city}` : ''));

function setCinemaStatus(next: string) {
  if (next === 'ACTIVE' || next === 'DISABLED' || next === 'DELETED') {
    status.value = next;
    if (cinema.value) cinema.value = { ...cinema.value, status: next };
  }
}

function loadCurrentCinema(force = false): Promise<CurrentCinema | null> {
  if (currentHostContext().plane !== 'tenant') return Promise.resolve(null);
  if (pending && !force) return pending;
  pending = apiClient
    .get<CurrentCinema>('/api/cinemas/current', { skipOfflineTrigger: true })
    .then(({ data }) => {
      cinema.value = data;
      setCinemaStatus(data.status);
      return data;
    })
    .catch(() => {
      pending = null;
      return null;
    });
  return pending;
}

export function useCurrentCinema() {
  return { cinema, cinemaDisabled, cinemaLabel, loadCurrentCinema, setCinemaStatus };
}
