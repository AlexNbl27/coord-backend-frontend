import { ref, onMounted, onUnmounted } from 'vue';
import axios from 'axios';

// Interface pour une séance (slot)
interface Slot {
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
interface SlotView {
  id: string;
  startsAt: string;
  status: string;
  version: number;
  movieTitle: string;
  hall: string;
}

// Interface pour la réservation
interface BookingView {
  bookingId: string;
  slotId: string;
  status: string;
}

// Interface pour l'événement SSE
interface SseEvent {
  slotId: string;
  status: string;
  version: number;
}

// URL de base pour l'API des séances
const API_SLOTS_URL = '/api/slots';
const API_SSE_EVENTS_URL = '/api/slots/events';

export function useSlots() {
  const slots = ref<Slot[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sseConnected = ref(false);
  const sseError = ref<string | null>(null);
  
  let eventSource: EventSource | null = null;

  // Récupérer toutes les séances
  const fetchSlots = async () => {
    try {
      loading.value = true;
      error.value = null;
      
      const response = await axios.get<SlotView[]>(API_SLOTS_URL);
      slots.value = response.data.map(slot => ({
        id: slot.id,
        startsAt: slot.startsAt,
        status: slot.status as 'AVAILABLE' | 'BOOKED',
        version: slot.version,
        movieTitle: slot.movieTitle,
        hall: slot.hall,
      }));
      
    } catch (err) {
      error.value = 'Impossible de récupérer les séances. Veuillez réessayer.';
      console.error('Erreur lors de la récupération des séances:', err);
    } finally {
      loading.value = false;
    }
  };

  // Connexion au flux SSE
  const connectSse = () => {
    // Fermer la connexion existante
    disconnectSse();

    try {
      // Créer une nouvelle connexion EventSource
      eventSource = new EventSource(API_SSE_EVENTS_URL);

      // Événement d'ouverture de la connexion
      eventSource.onopen = () => {
        sseConnected.value = true;
        sseError.value = null;
        console.log('✅ Connexion SSE établie');
        
        // Recharger les séances à la connexion
        fetchSlots();
      };

      // Événement d'erreur
      eventSource.onerror = (event) => {
        sseConnected.value = false;
        sseError.value = 'Erreur de connexion SSE. Tentative de reconnexion...';
        console.error('❌ Erreur SSE:', event);
        
        // Tentative de reconnexion après 5 secondes
        setTimeout(connectSse, 5000);
      };

      // Événement initial "ready"
      eventSource.addEventListener('ready', (event) => {
        const data = JSON.parse(event.data);
        if (data.action === 'reload') {
          fetchSlots();
        }
      });

      // Événement de mise à jour de séance
      eventSource.addEventListener('slot-updated', (event) => {
        const data: SseEvent = JSON.parse(event.data);
        
        // Mettre à jour la séance correspondante
        const index = slots.value.findIndex(slot => slot.id === data.slotId);
        if (index !== -1) {
          slots.value[index] = {
            ...slots.value[index],
            status: data.status as 'AVAILABLE' | 'BOOKED',
            version: data.version,
          };
          console.log(`🎟️ Séance ${data.slotId} mise à jour: ${data.status}`);
        }
      });

    } catch (err) {
      sseConnected.value = false;
      sseError.value = 'Impossible d\'établir la connexion SSE.';
      console.error('Erreur lors de la création de EventSource:', err);
    }
  };

  // Déconnecter SSE
  const disconnectSse = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
      sseConnected.value = false;
      console.log('🔌 Connexion SSE fermée');
    }
  };

  // Réserver une séance
  const reserveSlot = async (slotId: string, customerId: string): Promise<BookingView> => {
    try {
      const response = await axios.post<BookingView>(`${API_SLOTS_URL}/${slotId}/reservations`, {
        customerId,
      });
      
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

  // Filtrer les séances disponibles
  const availableSlots = ref<Slot[]>([]);
  
  // Filtrer les séances réservées
  const bookedSlots = ref<Slot[]>([]);

  // Mettre à jour les listes de séances
  const updateSlotLists = () => {
    availableSlots.value = getSlotsByStatus('AVAILABLE');
    bookedSlots.value = getSlotsByStatus('BOOKED');
  };

  // Hooks de cycle de vie
  onMounted(() => {
    connectSse();
    fetchSlots();
  });

  onUnmounted(() => {
    disconnectSse();
  });

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
