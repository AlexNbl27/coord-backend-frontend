import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import Navbar from '@/components/Navbar.vue';
import App from '@/App.vue';
import { expectNoA11yViolations } from '../setup';

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), go: vi.fn() }),
  useRoute: () => ({ path: '/' }),
  RouterLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
  RouterView: {
    template: '<div>Contenu de la vue</div>',
  },
}));

vi.mock('@/composables/useAbTest', () => ({
  useAbTest: () => ({
    initAssignment: vi.fn(),
    variant: ref('A'),
    fetchMetrics: vi.fn().mockResolvedValue({ variants: [], summary: {} }),
    simulateData: vi.fn(),
    experimentId: ref('exp-1'),
    exposed: ref(true),
    measured: ref(false),
    bookingButtonLabel: ref('Réserver'),
  }),
}));

vi.mock('@/composables/useSlots', () => ({
  useSlots: () => ({
    connectSse: vi.fn(),
    resetSlots: vi.fn(),
  }),
}));

vi.mock('@/composables/useConnection', () => ({
  useConnection: () => ({
    initConnectionWatcher: vi.fn(),
    status: ref('ONLINE'),
    isOnline: ref(true),
    isOffline: ref(false),
    isReconnecting: ref(false),
    pendingCount: ref(0),
    triggerManualReconnect: vi.fn(),
  }),
}));

vi.mock('@/composables/useReservations', () => ({
  useReservations: () => ({
    activeBookingsCount: ref(2),
    bookings: ref([]),
    downloadCalendarFile: vi.fn(),
  }),
}));

describe('Flux 5 : Navigation Globale & Ergonomie Clavier (A11y)', () => {
  it('App.vue doit comporter un lien d\'évitement (Skip Link) au sommet du DOM', async () => {
    const { container } = render(App);

    // Le lien d'évitement doit pointer vers le contenu principal
    const skipLink = screen.getByRole('link', {
      name: /aller au contenu/i,
    });
    expect(skipLink).toBeTruthy();
    expect(skipLink.getAttribute('href')).toBe('#main-content');

    // Le repère principal id="main-content" doit exister
    const mainContent = container.querySelector('#main-content');
    expect(mainContent).toBeTruthy();
    expect(mainContent?.tagName.toLowerCase()).toBe('main');
  });

  describe('Composant Navbar', () => {
    it('doit être sémantiquement structuré avec un repère nav étiqueté et un bouton burger accessible', async () => {
      const { container } = render(Navbar);

      // Repère navigation principale
      const navElement = screen.getByRole('navigation', {
        name: /principale/i,
      });
      expect(navElement).toBeTruthy();

      // Bouton menu mobile accessible
      const burgerButton = screen.getByRole('button', {
        name: /menu/i,
      });
      expect(burgerButton).toBeTruthy();
      expect(burgerButton.getAttribute('aria-expanded')).toBe('false');
      expect(burgerButton.getAttribute('aria-controls')).toBeTruthy();

      // Ouverture du menu au clic
      await userEvent.click(burgerButton);
      expect(burgerButton.getAttribute('aria-expanded')).toBe('true');

      // Audit axe-core
      await expectNoA11yViolations(container);
    });

    it('le logo doit avoir un libellé accessible explicite pour les lecteurs d\'écran', () => {
      render(Navbar);

      const logoLink = screen.getByRole('link', {
        name: /cinéslot.*accueil/i,
      });
      expect(logoLink).toBeTruthy();
    });
  });
});

