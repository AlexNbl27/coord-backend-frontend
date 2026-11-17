import { ref } from 'vue';
import { apiClient } from '../services/apiClient';

export const RESERVATION_ACTIONS = ['BOOKED', 'CANCELLED', 'REJECTED_DISABLED', 'REJECTED_FULL', 'REJECTED_CONFLICT'] as const;
export type ReservationAction = (typeof RESERVATION_ACTIONS)[number];

export interface ReservationLogEntry {
  id: string;
  at: string;
  action: ReservationAction;
  cinemaSlug: string | null;
  slotId: string | null;
  movieId: string | null;
  bookingId: string | null;
  userId: string | null;
  quantity: number;
  traceId: string | null;
}

export interface AuditEntry {
  seq: number;
  at: string;
  actor: { id: string; role: string | null } | null;
  action: string;
  target: { type?: string; id?: string; cinemaSlug?: string | null } | null;
  result: string;
  hash: string;
}

export interface Paged<T> {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  items: T[];
}

export type LogFilters = Record<string, string>;

export const PAGE_SIZE = 25;

const JAEGER_BASE_URL = (import.meta.env.VITE_JAEGER_URL || 'http://localhost:16686').replace(/\/$/, '');

export function jaegerTraceUrl(traceId: string): string {
  return `${JAEGER_BASE_URL}/trace/${encodeURIComponent(traceId)}`;
}

function errorMessage(err: any): string {
  const status = err?.response?.status;
  if (status === 403) return 'Vous n\'avez pas accès à ces journaux.';
  if (status === 401) return 'Votre session a expiré. Reconnectez-vous.';
  return err?.response?.data?.detail || 'Impossible de charger les journaux.';
}

export function usePagedLogs<T>(url: string) {
  const items = ref<T[]>([]) as { value: T[] };
  const page = ref(1);
  const totalPages = ref(1);
  const total = ref(0);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const load = async (filters: LogFilters, targetPage = 1) => {
    loading.value = true;
    error.value = null;
    const params: Record<string, string | number> = { page: targetPage, limit: PAGE_SIZE };
    for (const [key, value] of Object.entries(filters)) {
      if (value.trim()) params[key] = value.trim();
    }
    try {
      const { data } = await apiClient.get<Paged<T>>(url, { params, skipOfflineTrigger: true });
      items.value = data.items;
      page.value = data.page;
      totalPages.value = data.totalPages;
      total.value = data.total;
    } catch (err) {
      error.value = errorMessage(err);
      items.value = [];
      total.value = 0;
      totalPages.value = 1;
    } finally {
      loading.value = false;
    }
  };

  return { items, page, totalPages, total, loading, error, load };
}
