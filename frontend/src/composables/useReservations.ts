import { ref, computed } from 'vue';
import { apiClient } from '../services/apiClient';
import { offlineQueue } from '../services/offlineQueue';
import { useConnectionStore } from '../stores/connection';

export interface UserBooking {
  bookingId: string;
  slotId: string;
  movieTitle: string;
  startsAt: string;
  hall: string;
  poster?: string;
  bookedAt: string;
  seat: string;
  status: 'ACTIVE' | 'CANCELLED' | 'PENDING_SYNC' | 'CANCELLED_PENDING_SYNC';
}

const STORAGE_KEY = 'cineslot_my_bookings';

// État partagé réactif
const bookings = ref<UserBooking[]>(loadInitialBookings());

function generateSeat(slotId: string, bookingId: string): string {
  const rows = ['D', 'E', 'F', 'G', 'H', 'J', 'K'];
  const combined = `${slotId}:${bookingId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i += 1) {
    hash = (hash * 31 + combined.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash);
  const row = rows[positive % rows.length];
  const seatNum = ((positive >> 2) % 20) + 1;
  return `Rangée ${row} · Fauteuil ${seatNum}`;
}

function loadInitialBookings(): UserBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: UserBooking[] = JSON.parse(raw);
    return list.map(b => ({
      ...b,
      seat: b.seat || generateSeat(b.slotId, b.bookingId),
    }));
  } catch (e) {
    console.error('Erreur chargement réservations:', e);
    return [];
  }
}

function persistBookings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings.value));
  } catch (e) {
    console.error('Erreur sauvegarde réservations:', e);
  }
}

// Initialisation des callbacks de réconciliation hors-ligne
offlineQueue.registerCallbacks(
  (tempBookingId: string, serverBookingId: string, slotId: string) => {
    const target = bookings.value.find(b => b.bookingId === tempBookingId || b.slotId === slotId);
    if (target) {
      target.bookingId = serverBookingId;
      target.status = 'ACTIVE';
      persistBookings();
      console.log(`[useReservations] Réservation ${slotId} confirmée par le serveur avec l'ID ${serverBookingId}`);
    }
  },
  (slotId: string, movieTitle: string) => {
    const target = bookings.value.find(b => b.slotId === slotId);
    if (target) {
      target.status = 'CANCELLED';
      persistBookings();
    }
    try {
      const store = useConnectionStore();
      store.showToast(`Séance "${movieTitle}" déjà réservée par un tiers pendant la coupure`, 'error', 6000);
    } catch {}
  }
);

export function useReservations() {
  const activeBookings = computed(() => {
    return bookings.value.filter(b => b.status === 'ACTIVE' || b.status === 'PENDING_SYNC');
  });

  const activeBookingsCount = computed(() => activeBookings.value.length);

  const saveBooking = (item: {
    bookingId: string;
    slotId: string;
    movieTitle: string;
    startsAt: string;
    hall: string;
    poster?: string;
    seat?: string;
    status?: 'ACTIVE' | 'PENDING_SYNC';
  }) => {
    const seat = item.seat || generateSeat(item.slotId, item.bookingId);
    const effectiveStatus = item.status || (item.bookingId.startsWith('temp_') ? 'PENDING_SYNC' : 'ACTIVE');
    const newBooking: UserBooking = {
      ...item,
      seat,
      bookedAt: new Date().toISOString(),
      status: effectiveStatus,
    };

    // Évite les doublons
    const existingIndex = bookings.value.findIndex(b => b.slotId === item.slotId);
    if (existingIndex >= 0) {
      bookings.value[existingIndex] = newBooking;
    } else {
      bookings.value.unshift(newBooking);
    }
    persistBookings();
    return newBooking;
  };

  const cancelBooking = async (slotId: string): Promise<boolean> => {
    try {
      await apiClient.delete(`/api/slots/${slotId}/reservations`, {
        withCredentials: true,
      });
      const target = bookings.value.find(b => b.slotId === slotId);
      if (target) {
        target.status = 'CANCELLED';
        persistBookings();
      }
      return true;
    } catch (err: any) {
      // Si déjà annulé côté serveur (400 ou 404), on synchronise l'état local
      if (err.response && (err.response.status === 400 || err.response.status === 404)) {
        const target = bookings.value.find(b => b.slotId === slotId);
        if (target) {
          target.status = 'CANCELLED';
          persistBookings();
        }
        return true;
      }

      // Si erreur réseau / backend inaccessible : mise en file d'attente hors-ligne & mise à jour optimiste
      const isNetworkOrServer = !err.response || err.response.status >= 500;
      if (isNetworkOrServer) {
        console.warn(`[useReservations] Backend indisponible. Mise en file d'attente de l'annulation pour ${slotId}.`);
        offlineQueue.enqueue('CANCEL_SLOT', { slotId });
        const target = bookings.value.find(b => b.slotId === slotId);
        if (target) {
          target.status = 'CANCELLED_PENDING_SYNC';
          persistBookings();
        }
        return true;
      }

      console.error('Erreur annulation réservation:', err);
      throw err;
    }
  };

  const deleteFromHistory = (bookingId: string) => {
    bookings.value = bookings.value.filter(b => b.bookingId !== bookingId);
    persistBookings();
  };

  const downloadCalendarFile = (booking: UserBooking) => {
    const startDate = new Date(booking.startsAt);
    const endDate = new Date(startDate.getTime() + 2.5 * 60 * 60 * 1000); // +2h30

    const formatIcsDate = (d: Date) => {
      return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CinéSlot//Séance Cinéma//FR',
      'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      `UID:${booking.bookingId}@cineslot.fr`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${booking.movieTitle} - CinéSlot`,
      `DESCRIPTION:Séance pour ${booking.movieTitle}\\nSalle: ${booking.hall}\\nSiège: ${booking.seat}\\nBillet N°: ${booking.bookingId}`,
      `LOCATION:CinéSlot - ${booking.hall}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CineSlot-${booking.movieTitle.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    bookings,
    activeBookings,
    activeBookingsCount,
    saveBooking,
    cancelBooking,
    deleteFromHistory,
    downloadCalendarFile,
  };
}
