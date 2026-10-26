import { ref, computed } from 'vue';
import axios from 'axios';
import { useSlotsStore } from '../stores/slots';
import { useAbTest } from './useAbTest';

// Interface pour une séance (slot)
export interface Slot {
  id: string;
  startsAt: string;
  status: 'AVAILABLE' | 'BOOKED';
  version: number;
  movieTitle: string;
  hall: string;
  bookingId?: string;
  bookedBy?: string;
}

// Interface pour la vue d'une séance (API)
export interface SlotView {
  id: string;
  startsAt: string;
  status: string;
  version: number;
  movieTitle: string;
  hall: string;
}

// Interface pour la réservation
export interface BookingView {
  bookingId: string;
  slotId: string;
  status: string;
}

// Interface pour l'événement SSE
export interface SseEvent {
  slotId: string;
  status: string;
  version: number;
}

// URL de base pour l'API des séances
const API_SLOTS_URL = '/api/slots';
const API_SSE_EVENTS_URL = '/api/slots/events';

let sharedEventSource: EventSource | null = null;

export function useSlots() {
  const slotsStore = useSlotsStore();
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sseError = ref<string | null>(null);

  const slots = computed(() => slotsStore.slots);
  const sseConnected = computed(() => slotsStore.sseConnected);

  // Récupérer toutes les séances
  const fetchSlots = async () => {
    try {
      loading.value = true;
      error.value = null;
      slotsStore.setLoading(true);
      
      const response = await axios.get<SlotView[]>(API_SLOTS_URL, {
        withCredentials: true
      });
      const mappedSlots: Slot[] = response.data.map(slot => ({
        id: slot.id,
        startsAt: slot.startsAt,
        status: slot.status as 'AVAILABLE' | 'BOOKED',
        version: slot.version,
        movieTitle: slot.movieTitle,
        hall: slot.hall,
      }));
      slotsStore.setSlots(mappedSlots);
      
    } catch (err) {
      error.value = 'Impossible de récupérer les séances. Veuillez réessayer.';
      slotsStore.setError(error.value);
      console.error('Erreur lors de la récupération des séances:', err);
    } finally {
      loading.value = false;
      slotsStore.setLoading(false);
    }
  };

  // Connexion au flux SSE
  const connectSse = () => {
    if (sharedEventSource && sharedEventSource.readyState !== EventSource.CLOSED) {
      return;
    }

    try {
      sharedEventSource = new EventSource(API_SSE_EVENTS_URL);

      sharedEventSource.onopen = () => {
        slotsStore.setSseConnected(true);
        sseError.value = null;
        console.log('Connexion SSE etablie');
        fetchSlots();
      };

      sharedEventSource.onerror = (event) => {
        slotsStore.setSseConnected(false);
        sseError.value = 'Erreur de connexion SSE. Tentative de reconnexion...';
        console.error('Erreur SSE:', event);
      };

      sharedEventSource.addEventListener('ready', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          if (data.action === 'reload') {
            fetchSlots();
          }
        } catch (e) {
          console.error('Erreur parsing SSE ready event:', e);
        }
      });

      sharedEventSource.addEventListener('slot-updated', (event: any) => {
        try {
          const data: SseEvent = JSON.parse(event.data);
          slotsStore.updateSlotStatus(data.slotId, data.status as 'AVAILABLE' | 'BOOKED');
          slotsStore.updateSlot(data.slotId, { version: data.version });
          console.log(`Seance ${data.slotId} mise a jour: ${data.status}`);
        } catch (e) {
          console.error('Erreur parsing SSE slot-updated event:', e);
        }
      });

    } catch (err) {
      slotsStore.setSseConnected(false);
      sseError.value = 'Impossible d\'établir la connexion SSE.';
      console.error('Erreur lors de la création de EventSource:', err);
    }
  };

  // Déconnecter SSE
  const disconnectSse = () => {
    if (sharedEventSource) {
      sharedEventSource.close();
      sharedEventSource = null;
      slotsStore.setSseConnected(false);
      console.log('Connexion SSE fermee');
    }
  };

  // Réserver une séance
  const reserveSlot = async (slotId: string, customerId: string): Promise<BookingView> => {
    try {
      const { measured } = useAbTest();
      const response = await axios.post<BookingView>(
        `${API_SLOTS_URL}/${slotId}/reservations`,
        { customerId },
        {
          headers: {
            'X-AB-Measure': String(measured.value)
          },
          withCredentials: true
        }
      );
      
      // La séance sera mise à jour automatiquement via SSE
      return response.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Impossible de réserver cette séance.';
      throw new Error(errorMessage);
    }
  };

  // Générer une nouvelle séance de démonstration
  const generateDemoSlot = async (): Promise<SlotView> => {
    try {
      const response = await axios.post<SlotView>(`${API_SLOTS_URL}/lab`);
      return response.data;
    } catch (err) {
      console.error('Erreur lors de la génération d\'une séance:', err);
      throw err;
    }
  };

  // Filtrer les séances par film
  const getSlotsByMovie = (movieTitle: string) => {
    return slots.value.filter(slot => 
      slot.movieTitle.toLowerCase().includes(movieTitle.toLowerCase())
    );
  };

  // Filtrer les séances par statut
  const getSlotsByStatus = (status: 'AVAILABLE' | 'BOOKED' | 'ALL' = 'ALL') => {
    if (status === 'ALL') return slots.value;
    return slots.value.filter(slot => slot.status === status);
  };

  // Filtrer les séances disponibles et réservées depuis le store
  const availableSlots = computed(() => slotsStore.availableSlots);
  const bookedSlots = computed(() => slotsStore.bookedSlots);

  // Mettre à jour les listes de séances (compatibilité)
  const updateSlotLists = () => {};

  // Rafraîchir manuellement les séances
  const refreshSlots = () => {
    fetchSlots();
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
    generateDemoSlot,
    getSlotsByMovie,
    getSlotsByStatus,
    refreshSlots,
    updateSlotLists,
  };
}
