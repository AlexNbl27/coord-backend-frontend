import { ref, computed, nextTick } from 'vue';
import { apiClient } from '../services/apiClient';

export interface AbMetric {
  variant: 'A' | 'B';
  assigned: number;
  exposed: number;
  converted: number;
  rate: number | null;
  confidenceInterval?: [number, number];
}

export interface AbSummary {
  zScore: number;
  pValue: number;
  isSignificant: boolean;
  relativeLift: number;
  srm: {
    hasMismatch: boolean;
    pValue: number;
    chiSquare?: number;
  };
  recommendation: 'A' | 'B' | null;
}

export interface AbAssignment {
  experimentId: string;
  variant: 'A' | 'B';
  enabled: boolean;
}

export interface AbMetricsData {
  variants: AbMetric[];
  summary?: AbSummary;
}

// État partagé réactif (singleton)
const variant = ref<'A' | 'B'>('A');
const enabled = ref<boolean>(true);
const experimentId = ref<string>('booking-label-v1');
const exposed = ref<boolean>(false);
const measured = ref<boolean>(false);
const initialized = ref<boolean>(false);

export function useAbTest() {
  /**
   * Libellé dynamique du bouton selon la variante A/B
   * Version A (référence) : "Réserver"
   * Version B (modification) : "Choisir ce créneau"
   */
  const bookingButtonLabel = computed(() => {
    return variant.value === 'B' ? 'Choisir ce créneau' : 'Réserver';
  });

  const initAssignment = async () => {
    if (initialized.value) return;
    try {
      const response = await apiClient.get<AbAssignment>('/api/ab/assignment', {
        skipOfflineTrigger: true,
      });
      variant.value = response.data.variant;
      enabled.value = response.data.enabled;
      experimentId.value = response.data.experimentId;
      initialized.value = true;
    } catch {
      variant.value = 'A';
    }
  };

  const exposeIfAvailable = async (hasAvailableSlots: boolean) => {
    if (!hasAvailableSlots || exposed.value || !enabled.value) {
      return;
    }

    await nextTick();

    try {
      await apiClient.post('/api/ab/exposure', {}, { skipOfflineTrigger: true });
      exposed.value = true;
      measured.value = true;
    } catch {
      // Ignore non-critical exposure tracking failures
    }
  };

  const fetchMetrics = async (): Promise<AbMetricsData> => {
    try {
      const response = await apiClient.get<any>('/api/ab/metrics');
      if (Array.isArray(response.data)) {
        return { variants: response.data };
      }
      return {
        variants: response.data.variants || [],
        summary: response.data.summary
      };
    } catch {
      return { variants: [] };
    }
  };

  const simulateData = async (params = {}) => {
    const response = await apiClient.post<any>('/api/ab/simulate', params);
    return response.data;
  };

  return {
    variant,
    enabled,
    experimentId,
    exposed,
    measured,
    bookingButtonLabel,
    initAssignment,
    exposeIfAvailable,
    fetchMetrics,
    simulateData
  };
}
