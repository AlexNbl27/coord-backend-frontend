export const PARIS_TIME_ZONE = 'Europe/Paris';
export const DEFAULT_CINEMA_ADDRESS = '14 rue de la Cinémathèque, 69002 Lyon';

const DAY_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: PARIS_TIME_ZONE
});

const TIME_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: false,
  timeZone: PARIS_TIME_ZONE
});

const ISSUED_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: false,
  timeZone: PARIS_TIME_ZONE
});

/**
 * Formats an ISO instant as a French weekday + day + month + year in Europe/Paris.
 * Example: "mardi 24 novembre 2026"
 */
export function formatTicketDay(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return String(isoDate ?? '');
  }
  return DAY_FORMATTER.format(date);
}

/**
 * Formats an ISO instant as French time in Europe/Paris ("9 h 30", "20 h 00").
 */
export function formatTicketTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const parts = TIME_FORMATTER.formatToParts(date);
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
  return `${Number.parseInt(hour, 10)} h ${minute}`;
}

/**
 * Formats the document issuance timestamp in Europe/Paris.
 */
export function formatIssuedOn(dateInput = new Date()) {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return ISSUED_FORMATTER.format(date).replace(':', ' h ');
}

/**
 * Builds a short, neutral reference from a booking UUID.
 */
export function buildTicketReference(bookingId) {
  const clean = String(bookingId ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = clean.slice(0, 8) || 'TICKET';
  return `BK-${suffix}`;
}

/**
 * Builds a deterministic seat label for a slot and booking ID.
 */
export function generateSeatLabel(slotId, bookingId) {
  const rows = ['D', 'E', 'F', 'G', 'H', 'J', 'K'];
  const combined = `${slotId}:${bookingId}`;
  let hash = 0;
  for (let i = 0; i < combined.length; i += 1) {
    hash = (hash * 31 + combined.charCodeAt(i)) | 0;
  }
  const positive = Math.abs(hash);
  const row = rows[positive % rows.length];
  const seatNumber = ((positive >> 2) % 20) + 1;
  return `Rangée ${row} · Fauteuil ${seatNumber}`;
}

/**
 * Converts a Booking record into a formatted, display-ready TicketView.
 */
export function createTicketView(booking) {
  return {
    reference: buildTicketReference(booking._id),
    spectatorName: booking.ownerName || 'Spectateur CinéSlot',
    movieTitle: booking.movieTitle || 'Séance CinéSlot',
    hall: booking.hall || 'Salle Principale',
    address: booking.address || DEFAULT_CINEMA_ADDRESS,
    seat: booking.seat || generateSeatLabel(booking.slotId, booking._id),
    day: formatTicketDay(booking.startsAt),
    time: formatTicketTime(booking.startsAt),
    issuedOn: formatIssuedOn(booking.bookedAt || new Date())
  };
}
