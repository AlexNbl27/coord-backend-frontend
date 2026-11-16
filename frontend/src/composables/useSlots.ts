import { ref, computed } from 'vue';
import { apiClient } from '../services/apiClient';
import { cacheManager, CacheKeys } from '../services/cacheManager';
import { offlineQueue } from '../services/offlineQueue';
import { useSlotsStore } from '../stores/slots';
import { useConnectionStore } from '../stores/connection';
import { useConnection } from './useConnection';
import { useAbTest } from './useAbTest';
import { useReservations } from './useReservations';

export interface Slot {
  id: string;
  startsAt: string;
  status: 'AVAILABLE' | 'BOOKED';
  version: number;
  movieTitle: string;
  hall: string;
  capacity?: number;
  availableSeats?: number;
  bookingId?: string;
  bookedBy?: string;
}

export interface SlotView {
  id: string;
  startsAt: string;
  status: string;
  version: number;
  movieTitle: string;
  hall: string;
  capacity?: number;
  availableSeats?: number;
}

export interface TicketLine {
  category: string;
  label?: string;
  unitPrice?: number;
  quantity: number;
}

export interface BookingView {
  bookingId: string;
  slotId: string;
  status: string;
  seat?: string;
  tickets?: TicketLine[];
  totalQuantity?: number;
  totalAmount?: number;
  availableSeats?: number;
  capacity?: number;
}

export interface SseEvent {
  slotId: string;
  status: string;
  version: number;
  capacity?: number;
  availableSeats?: number;
}

// URL de base pour l'API des séances
const API_SLOTS_URL = '/api/slots';
const API_SSE_EVENTS_URL = '/api/slots/events';

let sharedEventSource: EventSource | null = null;

// Initialisation du cache persistant
const initialCachedSlots = cacheManager.get<Slot[]>(CacheKeys.SLOTS);

export function useSlots() {
  const slotsStore = useSlotsStore();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sseError = ref<string | null>(null);

  // Charger le cache initial s'il existe et que le store est vide
  if (initialCachedSlots?.data && slotsStore.slots.length === 0) {
    slotsStore.setSlots(initialCachedSlots.data);
  }

  const slots = computed(() => slotsStore.slots);
  const sseConnected = computed(() => slotsStore.sseConnected);

  const fetchSlots = async () => {
    const cached = cacheManager.get<Slot[]>(CacheKeys.SLOTS);
    if (cached?.data && cached.data.length > 0 && slotsStore.slots.length === 0) {
      slotsStore.setSlots(cached.data);
    }

    try {
      if (useConnectionStore().isOffline) {
        if (cached?.data && cached.data.length > 0) {
          slotsStore.setSlots(cached.data);
        }
        loading.value = false;
        slotsStore.setLoading(false);
        return;
      }
    } catch {}

    const hasExistingSlots = slotsStore.slots.length > 0 || (cached?.data && cached.data.length > 0);
    if (!hasExistingSlots) {
      loading.value = true;
      slotsStore.setLoading(true);
    }

    try {
      error.value = null;
      
      const response = await apiClient.get<SlotView[]>(API_SLOTS_URL, {
        withCredentials: true,
      });

      const mappedSlots: Slot[] = response.data.map(slot => ({
        id: slot.id,
        startsAt: slot.startsAt,
        status: slot.status as 'AVAILABLE' | 'BOOKED',
        version: slot.version,
        movieTitle: slot.movieTitle,
        hall: slot.hall,
        capacity: slot.capacity,
        availableSeats: slot.availableSeats,
      }));

      // Persistance dans le cache local (10 min)
      cacheManager.set(CacheKeys.SLOTS, mappedSlots, 10 * 60 * 1000);
      slotsStore.setSlots(mappedSlots);
      
    } catch (err: any) {
      // Repli fluide immédiat sur le cache local
      if (cached && cached.data.length > 0) {
        slotsStore.setSlots(cached.data);
        error.value = null;
      } else {
        error.value = 'Impossible de récupérer les séances. Mode hors-ligne sans cache.';
        slotsStore.setError(error.value);
        console.error('Erreur lors de la récupération des séances:', err);
      }
    } finally {
      loading.value = false;
      slotsStore.setLoading(false);
    }
  };

  // Connexion au flux SSE avec surveillance
  const connectSse = () => {
    if (sharedEventSource && sharedEventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    try {
      sharedEventSource = new EventSource(API_SSE_EVENTS_URL);

      sharedEventSource.onopen = () => {
        slotsStore.setSseConnected(true);
        sseError.value = null;
        console.log('[SSE] Connexion SSE établie');
      };

      sharedEventSource.onerror = (event) => {
        slotsStore.setSseConnected(false);
        sseError.value = 'Connexion SSE interrompue. Reconnexion automatique...';
        // Note: EventSource tente automatiquement de reconnecter de manière native
      };

      sharedEventSource.addEventListener('ready', (event: any) => {
        slotsStore.setSseConnected(true);
        try {
          const data = JSON.parse(event.data);
          if (data.action === 'reload') {
            fetchSlots();
          }
        } catch (e) {
          console.error('[SSE] Erreur parsing SSE ready event:', e);
        }
      });

      sharedEventSource.addEventListener('slot-updated', (event: any) => {
        slotsStore.setSseConnected(true);
        try {
          const data: SseEvent = JSON.parse(event.data);
          slotsStore.updateSlotStatus(data.slotId, data.status as 'AVAILABLE' | 'BOOKED');
          slotsStore.updateSlot(data.slotId, {
            version: data.version,
            ...(data.capacity !== undefined ? { capacity: data.capacity } : {}),
            ...(data.availableSeats !== undefined ? { availableSeats: data.availableSeats } : {}),
          });
        } catch (e) {
          console.error('[SSE] Error parsing slot-updated event:', e);
        }
      });

    } catch (err) {
      slotsStore.setSseConnected(false);
      sseError.value = 'Impossible d\'établir la connexion SSE.';
      console.error('[SSE] Erreur lors de la création de EventSource:', err);
    }
  };

  // Déconnecter SSE
  const disconnectSse = () => {
    if (sharedEventSource) {
      sharedEventSource.close();
      sharedEventSource = null;
      slotsStore.setSseConnected(false);
      console.log('[SSE] Connexion SSE fermée');
    }
  };

  // Enregistrement de la synchronisation au retour de connexion
  try {
    const { onReconnectSync } = useConnection();
    onReconnectSync(async () => {
      console.log('[useSlots] Reconnexion détectée, réactualisation SSE et séances...');
      disconnectSse();
      connectSse();
      await fetchSlots();
    });
  } catch {
    // Si hors contexte Vue
  }

  const reserveSlot = async (
    slotId: string,
    customerId: string = '',
    tickets?: TicketLine[]
  ): Promise<BookingView> => {
    const { measured } = useAbTest();

    try {
      const response = await apiClient.post<BookingView>(
        `${API_SLOTS_URL}/${slotId}/reservations`,
        { customerId, ...(tickets ? { tickets } : {}) },
        {
          headers: {
            'X-AB-Measure': String(measured.value),
          },
        }
      );

      slotsStore.updateSlot(slotId, {
        status: response.data.status as 'AVAILABLE' | 'BOOKED',
        ...(response.data.availableSeats !== undefined
          ? { availableSeats: response.data.availableSeats }
          : {}),
        ...(response.data.capacity !== undefined
          ? { capacity: response.data.capacity }
          : {}),
      });
      return response.data;
    } catch (err: any) {
      const isNetworkOrServer = !err.response || err.response.status >= 500;

      // Si le backend est déconnecté ou en panne : Outbox Pattern & Résilience
      if (isNetworkOrServer) {
        console.warn(`[useSlots] Backend hors-ligne : mise en file d'attente de la réservation pour le créneau ${slotId}.`);
        
        const tempBookingId = `temp_bk_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        
        slotsStore.updateSlotStatus(slotId, 'BOOKED');

        offlineQueue.enqueue('RESERVE_SLOT', {
          slotId,
          customerId,
          tempBookingId,
        });

        return {
          bookingId: tempBookingId,
          slotId,
          status: 'BOOKED',
        };
      }

      // En cas de conflit réel 409 ou autre erreur métier
      const errorMessage = err.response?.data?.message || (err instanceof Error ? err.message : 'Impossible de réserver cette séance.');
      throw new Error(errorMessage);
    }
  };

  const availableSlots = computed(() => slotsStore.availableSlots);
  const bookedSlots = computed(() => slotsStore.bookedSlots);

  const refreshSlots = () => {
    fetchSlots();
  };

  const resetSlots = async () => {
    try {
      loading.value = true;
      await apiClient.post(`${API_SLOTS_URL}/reset`, {});
      try {
        useReservations().markAllCancelledLocally();
      } catch {
        // Ignore in isolated unit-test environments
      }
      await fetchSlots();
    } catch (err) {
      console.error('Failed to reset slots:', err);
    } finally {
      loading.value = false;
    }
  };

  return {
    slots,
    availableSlots,
    bookedSlots,
    loading,
    error,
    sseConnected,
    sseError,
    fetchSlots,
    connectSse,
    disconnectSse,
    reserveSlot,
    resetSlots,
    refreshSlots,
  };
}
