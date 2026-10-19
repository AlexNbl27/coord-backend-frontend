import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import SlotCard from '@/components/SlotCard.vue';
import SseStatus from '@/components/SseStatus.vue';
import ConnectionBadge from '@/components/ConnectionBadge.vue';
import { expectNoA11yViolations } from '../setup';

// Mock pour useConnection
vi.mock('@/composables/useConnection', () => ({
  useConnection: () => ({
    status: ref('ONLINE'),
    isOnline: ref(true),
    isOffline: ref(false),
    isReconnecting: ref(false),
    pendingCount: ref(0),
    triggerManualReconnect: vi.fn(),
  }),
}));

// Mock pour useSlots
vi.mock('@/composables/useSlots', () => ({
  useSlots: () => ({
    sseConnected: ref(true),
    connectSse: vi.fn(),
    disconnectSse: vi.fn(),
  }),
}));

describe('Flux 2 : Consultation des Séances & Daltonisme (A11y)', () => {
  const mockSlotAvailable = {
    id: 's1',
    movieId: 'm1',
    movieTitle: 'Interstellar',
    hall: 'Salle 1 - IMAX',
    startsAt: '2026-10-30T20:00:00.000Z',
    status: 'AVAILABLE' as const,
  };

  const mockSlotBooked = {
    id: 's2',
    movieId: 'm1',
    movieTitle: 'Interstellar',
    hall: 'Salle 1 - IMAX',
    startsAt: '2026-10-30T22:30:00.000Z',
    status: 'BOOKED' as const,
  };

  describe('Composant SlotCard (Double encodage Daltonisme & VoiceOver)', () => {
    it('doit utiliser un double encodage (icône + texte) pour différencier les statuts Disponible et Complet', () => {
      const { container: containerAvailable } = render(SlotCard, {
        props: {
          slot: mockSlotAvailable,
          sseConnected: true,
        },
      });

      // Statut Disponible : texte ET icône de validation
      const badgeAvailable = screen.getByText(/disponible/i);
      expect(badgeAvailable).toBeTruthy();
      expect(badgeAvailable.textContent).toMatch(/[✓✔]/); // Symbole distinctif daltonien

      // Statut Complet : rendu distinct
      const { container: containerBooked } = render(SlotCard, {
        props: {
          slot: mockSlotBooked,
          sseConnected: true,
        },
      });

      const badgeBooked = screen.getByText(/complet/i);
      expect(badgeBooked).toBeTruthy();
      expect(badgeBooked.textContent).toMatch(/[✕✖⊘]/); // Symbole distinctif daltonien
    });

    it('le bouton de réservation doit avoir un nom accessible complet incluant le film et l\'horaire', async () => {
      let reserved = false;
      const { container } = render(SlotCard, {
        props: {
          slot: mockSlotAvailable,
          sseConnected: true,
        },
        attrs: {
          onReserve: () => { reserved = true; }
        }
      });

      // Le bouton doit être actionnable et son nom accessible explicite
      const bookButton = screen.getByRole('button', {
        name: /Interstellar/i,
      });
      expect(bookButton).toBeTruthy();

      await userEvent.click(bookButton);
      expect(reserved).toBe(true);

      // Audit axe-core
      await expectNoA11yViolations(container);
    });
  });

  describe('Composants SseStatus & ConnectionBadge', () => {
    it('le voyant SSE doit posséder un role status et un double encodage sans dépendre uniquement du hover souris', async () => {
      const { container } = render(SseStatus);

      const statusElement = screen.getByRole('status');
      expect(statusElement).toBeTruthy();
      // Le statut doit être perceptible immédiatement pour un lecteur d'écran
      expect(statusElement.getAttribute('aria-label') || statusElement.textContent).toMatch(/connecté|en direct|sse/i);

      await expectNoA11yViolations(container);
    });

    it('le badge de connexion doit être un repère de statut accessible au lecteur d\'écran', async () => {
      const { container } = render(ConnectionBadge);

      const statusBadge = container.querySelector('[role="status"]');
      expect(statusBadge).toBeTruthy();
      expect(statusBadge?.textContent).toMatch(/en ligne/i);

      await expectNoA11yViolations(container);
    });
  });
});

