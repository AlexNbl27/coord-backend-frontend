import { ref, computed, nextTick } from 'vue';
import axios from 'axios';

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

  /**
   * Initialise ou récupère l'affectation du visiteur depuis le backend
   */
  const initAssignment = async () => {
    if (initialized.value) return;
    try {
      const response = await axios.get<AbAssignment>('/api/ab/assignment', {
        withCredentials: true
      });
      variant.value = response.data.variant;
      enabled.value = response.data.enabled;
      experimentId.value = response.data.experimentId;
      initialized.value = true;
      console.log(`[A/B Test] Affectation reçue : Variante ${variant.value} (enabled: ${enabled.value})`);
    } catch (err) {
      console.warn('[A/B Test] Erreur lors de l\'affectation, bascule sur la variante A par défaut:', err);
      variant.value = 'A';
    }
  };

  /**
   * Déclenche l'exposition uniquement si au moins un créneau disponible est rendu
   * Attend impérativement le tick Vue (nextTick) pour garantir le rendu effectif dans le DOM
   */
  const exposeIfAvailable = async (hasAvailableSlots: boolean) => {
    if (!hasAvailableSlots || exposed.value || !enabled.value) {
      return;
    }

    await nextTick();

    try {
      await axios.post('/api/ab/exposure', {}, {
        withCredentials: true
      });
      exposed.value = true;
      measured.value = true;
      console.log('[A/B Test] Exposition enregistrée avec succès.');
    } catch (err) {
      console.error('[A/B Test] Erreur lors de l\'enregistrement de l\'exposition:', err);
    }
  };

  /**
   * Récupère les métriques consolidées du test A/B (variantes et synthèse statistique)
   */
  const fetchMetrics = async (): Promise<AbMetricsData> => {
    try {
      const response = await axios.get<any>('/api/ab/metrics', {
        withCredentials: true
      });
      if (Array.isArray(response.data)) {
        return { variants: response.data };
      }
      return {
        variants: response.data.variants || [],
        summary: response.data.summary
      };
    } catch (err) {
      console.error('[A/B Test] Erreur lors de la récupération des métriques:', err);
      return { variants: [] };
    }
  };

  /**
   * Simule un jeu de données complet pour tester la réactivité et le verdict statistique
   */
  const simulateData = async (params = {}) => {
    try {
      const response = await axios.post<any>('/api/ab/simulate', params, {
        withCredentials: true
      });
      return response.data;
    } catch (err) {
      console.error('[A/B Test] Erreur lors de la simulation:', err);
      throw err;
    }
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
