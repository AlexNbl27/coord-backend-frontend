import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Slot } from '../composables/useSlots';

export const useSlotsStore = defineStore('slots', () => {
  // État
  const slots = ref<Slot[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const sseConnected = ref(false);
  const sseError = ref<string | null>(null);
  const selectedMovieTitle = ref<string | undefined>(undefined);

  // Getters
  const hasSlots = computed(() => slots.value.length > 0);
  
  const availableSlots = computed(() => {
    return slots.value.filter(slot => slot.status === 'AVAILABLE');
  });

  const bookedSlots = computed(() => {
    return slots.value.filter(slot => slot.status === 'BOOKED');
  });

  const slotsByMovie = computed(() => {
    const moviesMap = new Map<string, Slot[]>();
    slots.value.forEach(slot => {
      const movieTitle = slot.movieTitle;
      if (!moviesMap.has(movieTitle)) {
        moviesMap.set(movieTitle, []);
      }
      moviesMap.get(movieTitle)!.push(slot);
    });
    return moviesMap;
  });

  const availableSlotsCount = computed(() => {
    return availableSlots.value.length;
  });

  const bookedSlotsCount = computed(() => {
    return bookedSlots.value.length;
  });

  const nextAvailableSlot = computed(() => {
    return availableSlots.value
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())[0];
  });

  // Actions
  const setSlots = (newSlots: Slot[]) => {
    slots.value = newSlots;
  };

  const addSlot = (newSlot: Slot) => {
    slots.value = [...slots.value, newSlot];
  };

  const updateSlot = (slotId: string, updates: Partial<Slot>) => {
    const index = slots.value.findIndex(slot => slot.id === slotId);
    if (index !== -1) {
      slots.value[index] = { ...slots.value[index], ...updates };
    }
  };

  const updateSlotStatus = (slotId: string, status: 'AVAILABLE' | 'BOOKED') => {
    updateSlot(slotId, { status });
  };

  const removeSlot = (slotId: string) => {
    slots.value = slots.value.filter(slot => slot.id !== slotId);
  };

  const setLoading = (isLoading: boolean) => {
    loading.value = isLoading;
  };

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage;
  };

  const setSseConnected = (connected: boolean) => {
    sseConnected.value = connected;
  };

  const setSseError = (errorMessage: string | null) => {
    sseError.value = errorMessage;
  };

  const setSelectedMovieTitle = (movieTitle: string | undefined) => {
    selectedMovieTitle.value = movieTitle;
  };

  const clearSlots = () => {
    slots.value = [];
  };

  const refreshSlots = async () => {
    // À implémenter avec l'API
  };

  return {
    // State
    slots,
    loading,
    error,
    sseConnected,
    sseError,
    selectedMovieTitle,
    
    // Getters
    hasSlots,
    availableSlots,
    bookedSlots,
    slotsByMovie,
    availableSlotsCount,
    bookedSlotsCount,
    nextAvailableSlot,
    
    // Actions
    setSlots,
    addSlot,
    updateSlot,
    updateSlotStatus,
    removeSlot,
    setLoading,
    setError,
    setSseConnected,
    setSseError,
    setSelectedMovieTitle,
    clearSlots,
    refreshSlots,
  };
});
