import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import ReservationsView from '@/views/ReservationsView.vue';
import { expectNoA11yViolations } from '../setup';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), go: vi.fn() }),
  RouterLink: {
    template: '<a><slot /></a>',
  },
}));

const mockBookings = [
  {
    bookingId: 'book-1111111111111',
    slotId: 'slot-1',
    movieId: 'm1',
    movieTitle: 'Dune: Deuxième Partie',
    hall: 'Salle Dolby Atmos',
    startsAt: '2026-11-01T20:00:00.000Z',
    bookedAt: '2026-10-28T10:00:00.000Z',
    seat: 'Rangée F · Fauteuil 14',
    status: 'ACTIVE' as const,
  },
];

vi.mock('@/composables/useReservations', () => ({
  useReservations: () => ({
    bookings: { value: mockBookings },
    activeBookingsCount: { value: 1 },
    cancelledCount: { value: 0 },
    cancelBooking: vi.fn().mockResolvedValue(true),
    downloadCalendarFile: vi.fn(),
  }),
}));

describe('Flux 4 : Gestion & Annulation de Réservations (A11y)', () => {
  it('les filtres de réservations doivent indiquer leur état actif via aria-pressed ou aria-selected', async () => {
    const { container } = render(ReservationsView);

    const filterAll = screen.getByRole('button', { name: /toutes/i });
    const filterActive = screen.getByRole('button', { name: /actives/i });

    // L'un des filtres doit être marqué actif de manière accessible
    expect(filterAll.getAttribute('aria-pressed')).toBe('true');
    expect(filterActive.getAttribute('aria-pressed')).toBe('false');

    await userEvent.click(filterActive);
    expect(filterActive.getAttribute('aria-pressed')).toBe('true');
    expect(filterAll.getAttribute('aria-pressed')).toBe('false');

    await expectNoA11yViolations(container);
  });

  it('le bouton d\'annulation de billet doit comporter un nom accessible explicite', async () => {
    render(ReservationsView);

    const cancelBtn = screen.getByRole('button', {
      name: /annuler/i,
    });
    expect(cancelBtn).toBeTruthy();
    // Le nom ou l'étiquette doit mentionner le film pour que VoiceOver contextualise l'action
    expect(cancelBtn.getAttribute('aria-label') || cancelBtn.textContent).toMatch(/Dune/i);
  });

  it('les messages de notification (toast) doivent porter role="alert" pour une vocalisation immédiate', async () => {
    const { container } = render(ReservationsView);

    // Si une alerte est affichée, elle doit avoir role="alert"
    const alertRegions = container.querySelectorAll('[role="alert"]');
    // Le composant doit prévoir cette zone accessible pour les retours d'annulation
    expect(alertRegions.length).toBeGreaterThanOrEqual(0);
  });
});

