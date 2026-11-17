import { ref, computed } from "vue";
import { apiClient } from "../services/apiClient";
import { offlineQueue } from "../services/offlineQueue";
import { useConnectionStore } from "../stores/connection";
import { currentHostContext, isValidSlug, tenantUrl } from "../services/tenant";

export interface UserBooking {
  bookingId: string;
  slotId: string;
  cinemaSlug?: string;
  cinemaName?: string;
  movieTitle: string;
  startsAt: string;
  hall: string;
  poster?: string;
  bookedAt: string;
  seat: string;
  tickets?: Array<{ category: string; label?: string; unitPrice?: number; quantity: number }>;
  totalQuantity?: number;
  totalAmount?: number;
  status: 'ACTIVE' | 'CANCELLED' | 'PENDING_SYNC' | 'CANCELLED_PENDING_SYNC';
}

const STORAGE_KEY = "cineslot_my_bookings";
const SESSION_DURATION_MS = 2.5 * 60 * 60 * 1000; // +2h30

function getSessionDates(booking: UserBooking) {
  const startDate = new Date(booking.startsAt);
  const endDate = new Date(startDate.getTime() + SESSION_DURATION_MS);
  return { startDate, endDate };
}

function formatIcsDate(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export function buildGoogleCalendarUrl(booking: UserBooking): string {
  const { startDate, endDate } = getSessionDates(booking);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `${booking.movieTitle} - CinéSlot`,
    dates: `${formatIcsDate(startDate)}/${formatIcsDate(endDate)}`,
    details: `Séance pour ${booking.movieTitle}\nSalle: ${booking.hall}\nSiège: ${booking.seat}\nBillet N°: ${booking.bookingId}`,
    location: `CinéSlot - ${booking.hall}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// État partagé réactif
const bookings = ref<UserBooking[]>(loadInitialBookings());

function generateSeat(slotId: string, bookingId: string, quantity = 1): string {
  const rows = ['D', 'E', 'F', 'G', 'H', 'J', 'K'];
  const combined = `${slotId}:${bookingId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i += 1) {
    hash = (hash * 31 + combined.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash);
  const row = rows[positive % rows.length];
  const baseSeat = ((positive >> 2) % 20) + 1;
  const qty = Math.max(1, Math.min(Number(quantity) || 1, 10));
  if (qty === 1) {
    return `Rangée ${row} · Fauteuil ${baseSeat}`;
  }
  const maxSeat = 20;
  const startSeat = baseSeat + qty - 1 > maxSeat ? Math.max(1, maxSeat - qty + 1) : baseSeat;
  const seats = Array.from({ length: qty }, (_, i) => startSeat + i);
  return `Rangée ${row} · Fauteuils ${seats.join(', ')}`;
}

function loadInitialBookings(): UserBooking[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list: UserBooking[] = JSON.parse(raw);
    return list.map((b) => ({
      ...b,
      seat: b.seat || generateSeat(b.slotId, b.bookingId),
    }));
  } catch (e) {
    console.error("Erreur chargement réservations:", e);
    return [];
  }
}

function persistBookings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings.value));
  } catch (e) {
    console.error("Erreur sauvegarde réservations:", e);
  }
}

// Initialisation des callbacks de réconciliation hors-ligne
offlineQueue.registerCallbacks(
  (tempBookingId: string, serverBookingId: string, slotId: string) => {
    const target = bookings.value.find(
      (b) => b.bookingId === tempBookingId || b.slotId === slotId,
    );
    if (target) {
      target.bookingId = serverBookingId;
      target.status = "ACTIVE";
      persistBookings();
      console.log(
        `[useReservations] Réservation ${slotId} confirmée par le serveur avec l'ID ${serverBookingId}`,
      );
    }
  },
  (slotId: string, movieTitle: string) => {
    const target = bookings.value.find((b) => b.slotId === slotId);
    if (target) {
      target.status = "CANCELLED";
      persistBookings();
    }
    try {
      const store = useConnectionStore();
      store.showToast(
        `Séance "${movieTitle}" déjà réservée par un tiers pendant la coupure`,
        "error",
        6000,
      );
    } catch {}
  },
);

export function clearLocalBookings() {
  bookings.value = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function useReservations() {
  const activeBookings = computed(() => {
    return bookings.value.filter(
      (b) => b.status === "ACTIVE" || b.status === "PENDING_SYNC",
    );
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
    tickets?: Array<{ category: string; label?: string; unitPrice?: number; quantity: number }>;
    totalQuantity?: number;
    totalAmount?: number;
    status?: 'ACTIVE' | 'PENDING_SYNC';
  }) => {
    const seat = item.seat || generateSeat(item.slotId, item.bookingId, item.totalQuantity || 1);
    const effectiveStatus = item.status || (item.bookingId.startsWith('temp_') ? 'PENDING_SYNC' : 'ACTIVE');
    const newBooking: UserBooking = {
      ...item,
      seat,
      bookedAt: new Date().toISOString(),
      status: effectiveStatus,
    };

    const existingIndex = bookings.value.findIndex(
      (b) => b.slotId === item.slotId,
    );
    if (existingIndex >= 0) {
      bookings.value[existingIndex] = newBooking;
    } else {
      bookings.value.unshift(newBooking);
    }
    persistBookings();
    return newBooking;
  };

  const cancelBooking = async (slotId: string, cinemaSlug?: string): Promise<boolean> => {
    try {
      const useCrossOrigin = Boolean(cinemaSlug && currentHostContext().plane === 'public' && isValidSlug(cinemaSlug));
      const cancelUrl = useCrossOrigin
        ? tenantUrl(cinemaSlug!, `/api/slots/${slotId}/reservations`)
        : `/api/slots/${slotId}/reservations`;
      await apiClient.delete(cancelUrl, {
        withCredentials: true,
      });
      const target = bookings.value.find((b) => b.slotId === slotId);
      if (target) {
        target.status = "CANCELLED";
        persistBookings();
      }
      return true;
    } catch (err: any) {
      if (
        err.response &&
        (err.response.status === 400 || err.response.status === 404)
      ) {
        const target = bookings.value.find((b) => b.slotId === slotId);
        if (target) {
          target.status = "CANCELLED";
          persistBookings();
        }
        return true;
      }

      const isNetworkOrServer = !err.response || err.response.status >= 500;
      if (isNetworkOrServer) {
        console.warn(
          `[useReservations] Backend indisponible. Mise en file d'attente de l'annulation pour ${slotId}.`,
        );
        offlineQueue.enqueue("CANCEL_SLOT", { slotId, cinemaSlug });
        const target = bookings.value.find((b) => b.slotId === slotId);
        if (target) {
          target.status = "CANCELLED_PENDING_SYNC";
          persistBookings();
        }
        return true;
      }

      console.error("Erreur annulation réservation:", err);
      throw err;
    }
  };

  const deleteFromHistory = (bookingId: string) => {
    bookings.value = bookings.value.filter((b) => b.bookingId !== bookingId);
    persistBookings();
  };

  const markAllCancelledLocally = () => {
    let changed = false;
    bookings.value.forEach((b) => {
      if (b.status === 'ACTIVE' || b.status === 'PENDING_SYNC') {
        b.status = 'CANCELLED';
        changed = true;
      }
    });
    if (changed) {
      persistBookings();
    }
  };

  const downloadCalendarFile = (booking: UserBooking) => {
    const { startDate, endDate } = getSessionDates(booking);

    const icsContent = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CinéSlot//Séance Cinéma//FR",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:${booking.bookingId}@cineslot.fr`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${booking.movieTitle} - CinéSlot`,
      `DESCRIPTION:Séance pour ${booking.movieTitle}\\nSalle: ${booking.hall}\\nSiège: ${booking.seat}\\nBillet N°: ${booking.bookingId}`,
      `LOCATION:CinéSlot - ${booking.hall}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([icsContent], {
      type: "text/calendar;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `CineSlot-${booking.movieTitle.replace(/\s+/g, "_")}.ics`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const openGoogleCalendar = (booking: UserBooking) => {
    window.open(buildGoogleCalendarUrl(booking), "_blank", "noopener");
  };

  const markBookingCancelled = (bookingId: string) => {
    const target = bookings.value.find((b) => b.bookingId === bookingId);
    if (target && target.status !== 'CANCELLED') {
      target.status = 'CANCELLED';
      persistBookings();
    }
  };

  const syncBookingsWithServer = async () => {
    try {
      const { data } = await apiClient.get<{ bookings: Array<{ bookingId: string; slotId: string }> }>(
        '/api/bookings/mine',
        { withCredentials: true }
      );
      const activeIds = new Set((data?.bookings ?? []).map((b) => b.bookingId));
      let changed = false;
      bookings.value.forEach((b) => {
        if (b.status === 'ACTIVE' && !activeIds.has(b.bookingId)) {
          b.status = 'CANCELLED';
          changed = true;
        }
      });
      if (changed) {
        persistBookings();
      }
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        clearLocalBookings();
      }
    }
  };

  const fetchAllCinemasBookings = async () => {
    try {
      const response = await apiClient.get<{ bookings: UserBooking[] }>('/api/my-bookings', {
        withCredentials: true,
        skipOfflineTrigger: true,
      });
      if (Array.isArray(response.data?.bookings)) {
        bookings.value = response.data.bookings;
      }
    } catch (err: any) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        clearLocalBookings();
      }
    }
  };

  const hasActiveBookingForSlot = (slotId: string) =>
    bookings.value.some(
      (b) => b.slotId === slotId && (b.status === 'ACTIVE' || b.status === 'PENDING_SYNC')
    );
  return {
    bookings,
    activeBookings,
    activeBookingsCount,
    hasActiveBookingForSlot,
    saveBooking,
    cancelBooking,
    deleteFromHistory,
    markAllCancelledLocally,
    markBookingCancelled,
    syncBookingsWithServer,
    fetchAllCinemasBookings,
    downloadCalendarFile,
    openGoogleCalendar,
  };
}
