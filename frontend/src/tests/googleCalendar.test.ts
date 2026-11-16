import { describe, expect, it } from 'vitest';
import { buildGoogleCalendarUrl, type UserBooking } from '@/composables/useReservations';

const booking: UserBooking = {
  bookingId: 'abc-123',
  slotId: 'slot-1',
  movieTitle: 'Dune : Deuxième Partie',
  startsAt: '2026-11-20T20:00:00.000Z',
  hall: 'Salle 3',
  bookedAt: '2026-11-16T10:00:00.000Z',
  seat: 'E12',
  status: 'ACTIVE'
};

describe('buildGoogleCalendarUrl', () => {
  it('pointe vers le formulaire de création Google Agenda', () => {
    const url = new URL(buildGoogleCalendarUrl(booking));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
  });

  it('pré-remplit le titre, le lieu et les infos du billet', () => {
    const url = new URL(buildGoogleCalendarUrl(booking));
    expect(url.searchParams.get('text')).toBe('Dune : Deuxième Partie - CinéSlot');
    expect(url.searchParams.get('location')).toBe('CinéSlot - Salle 3');
    expect(url.searchParams.get('details')).toContain('Siège: E12');
    expect(url.searchParams.get('details')).toContain('abc-123');
  });

  it('utilise une durée de 2h30 en UTC', () => {
    const url = new URL(buildGoogleCalendarUrl(booking));
    expect(url.searchParams.get('dates')).toBe('20261120T200000Z/20261120T223000Z');
  });
});
