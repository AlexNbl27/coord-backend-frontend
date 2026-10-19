import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { render, screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import ReservationModal from '@/components/ReservationModal.vue';
import AbMetricsModal from '@/components/AbMetricsModal.vue';
import ReservationsView from '@/views/ReservationsView.vue';
import { expectNoA11yViolations } from '../setup';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), go: vi.fn() }),
  useRoute: () => ({ path: '/' }),
  RouterLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
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
    bookings: ref(mockBookings),
    activeBookingsCount: ref(1),
    cancelledCount: ref(0),
    cancelBooking: vi.fn().mockResolvedValue(true),
    downloadCalendarFile: vi.fn(),
  }),
}));

vi.mock('@/composables/useAbTest', () => ({
  useAbTest: () => ({
    variant: ref('A'),
    experimentId: ref('exp-1'),
    exposed: ref(true),
    measured: ref(false),
    bookingButtonLabel: ref('Réserver'),
    fetchMetrics: vi.fn().mockResolvedValue({ variants: [], summary: {} }),
    simulateData: vi.fn(),
  }),
}));

vi.mock('@/composables/useSlots', () => ({
  useSlots: () => ({
    resetSlots: vi.fn(),
  }),
}));

describe('Scénarios Avancés : Gestion du Focus & Arrière-Plan Inerte sur les Dialogs (A11y)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // Simuler la structure de base de App.vue avec main-content
    const main = document.createElement('main');
    main.id = 'main-content';
    document.body.appendChild(main);
  });

  describe('Scénario 1 : Modale de Réservation (ReservationModal)', () => {
    it('doit placer le focus à l\'intérieur de la modale dès son ouverture et rendre l\'arrière-plan inerte', async () => {
      // Simuler un bouton déclencheur dans la page
      const openerBtn = document.createElement('button');
      openerBtn.textContent = 'Ouvrir réservation';
      document.getElementById('main-content')!.appendChild(openerBtn);
      openerBtn.focus();
      expect(document.activeElement).toBe(openerBtn);

      const { container } = render(ReservationModal, {
        props: {
          show: true,
          bookingId: 'book-123456789',
          movieTitle: 'Interstellar',
          startsAt: '2026-10-31T20:00:00.000Z',
          hall: 'Salle IMAX',
        },
      });

      await nextTick();

      // Le focus ne doit plus être sur le bouton de la page derrière
      expect(document.activeElement).not.toBe(openerBtn);

      // Le focus doit se trouver sur un élément interactif de la modale
      const dialog = screen.getByRole('dialog');
      expect(dialog.contains(document.activeElement)).toBe(true);

      // L'arrière-plan #main-content doit être marqué aria-hidden="true" / inert
      const mainContent = document.getElementById('main-content');
      expect(mainContent?.getAttribute('aria-hidden')).toBe('true');

      await expectNoA11yViolations(container);
    });

    it('doit restituer le focus au bouton d\'origine lors de la fermeture', async () => {
      const openerBtn = document.createElement('button');
      openerBtn.textContent = 'Ouvrir réservation';
      document.getElementById('main-content')!.appendChild(openerBtn);
      openerBtn.focus();

      const show = ref(true);
      const { rerender } = render(ReservationModal, {
        props: {
          show: show.value,
          bookingId: 'book-123456789',
          movieTitle: 'Interstellar',
          startsAt: '2026-10-31T20:00:00.000Z',
          hall: 'Salle IMAX',
        },
      });

      await nextTick();
      expect(document.getElementById('main-content')?.getAttribute('aria-hidden')).toBe('true');

      // Fermer la modale
      await rerender({ show: false });
      await nextTick();

      // L'arrière-plan doit redevenir accessible
      expect(document.getElementById('main-content')?.getAttribute('aria-hidden')).toBeNull();

      // Le focus doit être restitué au déclencheur
      expect(document.activeElement).toBe(openerBtn);
    });
  });

  describe('Scénario 2 : Modale Tableau de bord A/B (AbMetricsModal)', () => {
    it('doit être accessible, capturer le focus et se fermer avec Échap', async () => {
      let closed = false;
      const { container } = render(AbMetricsModal, {
        props: {
          show: true,
        },
        attrs: {
          onClose: () => { closed = true; },
        },
      });

      await nextTick();

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');

      // Le focus doit être dans la modale
      expect(dialog.contains(document.activeElement)).toBe(true);

      // Fermeture par Échap
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(closed).toBe(true);

      await expectNoA11yViolations(container);
    });
  });

  describe('Scénario 3 : Dialogue de Confirmation d\'Annulation (ReservationsView)', () => {
    it('doit afficher un alertdialog accessible et placer le focus sur le bouton d\'action lors de l\'annulation', async () => {
      render(ReservationsView);

      // Cliquer sur le bouton annuler d'un billet
      const cancelTrigger = screen.getByRole('button', {
        name: /annuler ma réservation/i,
      });
      await userEvent.click(cancelTrigger);

      // La boîte de dialogue de confirmation doit s'ouvrir avec role="alertdialog"
      const alertdialog = screen.getByRole('alertdialog');
      expect(alertdialog).toBeTruthy();
      expect(alertdialog.getAttribute('aria-modal')).toBe('true');

      // Le focus doit être déplacé dans le dialogue sur le bouton de sécurité ("Conserver")
      const keepBtn = screen.getByRole('button', { name: /conserver/i });
      expect(document.activeElement).toBe(keepBtn);

      // Annuler via Échap doit fermer le dialogue
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await waitFor(() => {
        expect(screen.queryByRole('alertdialog')).toBeNull();
      });
    });
  });
});
