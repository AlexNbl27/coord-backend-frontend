import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, screen } from '@testing-library/vue';
import SlotCard from '@/components/SlotCard.vue';
import ReservationModal from '@/components/ReservationModal.vue';
import ReservationsView from '@/views/ReservationsView.vue';
import SlotsView from '@/views/SlotsView.vue';
import { expectNoA11yViolations } from '../setup';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), go: vi.fn() }),
  useRoute: () => ({ path: '/slots' }),
  RouterLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
}));

const mockSlot = {
  id: 's-42',
  movieId: 'm-1',
  movieTitle: 'Inception',
  hall: 'Salle Dolby Atmos',
  startsAt: '2026-11-05T20:30:00.000Z',
  status: 'AVAILABLE' as const,
};

const mockBookings = [
  {
    bookingId: 'book-9999999999999',
    slotId: 'slot-42',
    movieId: 'm-1',
    movieTitle: 'Inception',
    hall: 'Salle Dolby Atmos',
    startsAt: '2026-11-05T20:30:00.000Z',
    bookedAt: '2026-10-28T10:00:00.000Z',
    seat: 'Rangée D · Fauteuil 8',
    status: 'ACTIVE' as const,
  },
];

vi.mock('@/composables/useReservations', () => ({
  useReservations: () => ({
    bookings: ref(mockBookings),
    activeBookingsCount: ref(1),
    cancelledCount: ref(0),
    cancelBooking: vi.fn().mockResolvedValue(true),
    deleteFromHistory: vi.fn(),
    downloadCalendarFile: vi.fn(),
  }),
}));

vi.mock('@/composables/useSlots', () => ({
  useSlots: () => ({
    slots: ref([mockSlot]),
    allSlots: ref([mockSlot]),
    loading: ref(false),
    sseConnected: ref(true),
    fetchSlots: vi.fn(),
    resetSlots: vi.fn(),
    reserveSlot: vi.fn(),
    connectSse: vi.fn(),
  }),
}));

vi.mock('@/composables/useMovies', () => ({
  useMovies: () => ({
    fetchMovies: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('@/composables/useAbTest', () => ({
  useAbTest: () => ({
    variant: ref('A'),
    experimentId: ref('exp-1'),
    exposed: ref(true),
    measured: ref(false),
    bookingButtonLabel: ref('Réserver ma place'),
  }),
}));

vi.mock('@/services/offlineQueue', () => ({
  offlineQueue: {
    isSlotPendingReservation: () => false,
  },
}));

describe('VoiceOver & Lecteurs d\'Écran : Contextualisation des Actions & Annonces (A11y)', () => {
  describe('1. Contexte d\'Action : Réservation de Séance (SlotCard)', () => {
    it('le bouton de réservation doit énoncer le film, l\'horaire et la salle pour VoiceOver', () => {
      render(SlotCard, {
        props: {
          slot: mockSlot,
          sseConnected: true,
        },
      });

      const btn = screen.getByRole('button', { name: /réserver une place pour inception/i });
      expect(btn).toBeTruthy();

      const label = btn.getAttribute('aria-label') || '';
      expect(label).toContain('Inception');
      expect(label).toContain('Salle Dolby Atmos');
    });

    it('le bouton doit préciser l\'impact hors-ligne si la connexion est perdue', () => {
      render(SlotCard, {
        props: {
          slot: mockSlot,
          sseConnected: false,
          isOffline: true,
        },
      });

      const btn = screen.getByRole('button', { name: /réserver une place pour inception/i });
      const label = btn.getAttribute('aria-label') || '';
      expect(label).toMatch(/hors-ligne|différée/i);
    });
  });

  describe('2. Contexte d\'Annonce : Confirmation de Réservation (ReservationModal)', () => {
    it('la modale doit fournir une description complète accessible via aria-describedby', () => {
      const { container } = render(ReservationModal, {
        props: {
          show: true,
          bookingId: 'book-9999999999999',
          movieTitle: 'Inception',
          startsAt: '2026-11-05T20:30:00.000Z',
          hall: 'Salle Dolby Atmos',
        },
      });

      const dialog = screen.getByRole('dialog');
      const describedById = dialog.getAttribute('aria-describedby');
      expect(describedById).toBeTruthy();

      const summaryEl = container.querySelector(`#${describedById}`);
      expect(summaryEl).toBeTruthy();
      expect(summaryEl?.textContent).toContain('Inception');
      expect(summaryEl?.textContent).toContain('Salle Dolby Atmos');

      // Boutons contextualisés
      const ticketsBtn = screen.getByRole('button', { name: /accéder à mes billets/i });
      expect(ticketsBtn.getAttribute('aria-label')).toContain('Inception');
    });
  });

  describe('3. Contexte d\'Action : Gestion et Annulation de Billet (ReservationsView)', () => {
    it('chaque bouton d\'action du billet doit préciser le film concerné pour VoiceOver', () => {
      render(ReservationsView);

      // Bouton agenda contextualisé
      const calBtn = screen.getByRole('button', { name: /ajouter la séance de inception/i });
      expect(calBtn).toBeTruthy();

      // Bouton impression contextualisé
      const printBtn = screen.getByRole('button', { name: /imprimer le billet pour inception/i });
      expect(printBtn).toBeTruthy();

      // Bouton annuler contextualisé
      const cancelBtn = screen.getByRole('button', { name: /annuler ma réservation pour le film inception/i });
      expect(cancelBtn).toBeTruthy();
    });

    it('le dialogue de confirmation d\'annulation doit expliciter l\'impact sur chaque bouton', async () => {
      render(ReservationsView);

      const cancelTrigger = screen.getByRole('button', { name: /annuler ma réservation pour le film inception/i });
      cancelTrigger.click();

      // Boutons dans l'alertdialog
      const keepBtn = await screen.findByRole('button', { name: /conserver ma réservation pour le film inception/i });
      expect(keepBtn).toBeTruthy();

      const confirmBtn = screen.getByRole('button', { name: /confirmer définitivement l'annulation de ma place pour inception/i });
      expect(confirmBtn).toBeTruthy();
    });
  });

  describe('4. Contexte des Filtres : Séances (SlotsView)', () => {
    it('les boutons de filtre de formats doivent porter aria-pressed et annoncer le résultat pour VoiceOver', async () => {
      const { container } = render(SlotsView);

      // Vérifier présence d'aria-pressed
      const allFormatBtn = screen.getByRole('button', { name: /tous les formats/i });
      expect(allFormatBtn.getAttribute('aria-pressed')).toBe('true');

      const imaxBtn = screen.getByRole('button', { name: /imax/i });
      expect(imaxBtn.getAttribute('aria-pressed')).toBe('false');

      // Zone d'annonce vocale live pour le nombre de résultats
      const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).toBeTruthy();
      expect(liveRegion?.textContent).toMatch(/\d+ séance/);

      await expectNoA11yViolations(container);
    });
  });
});

