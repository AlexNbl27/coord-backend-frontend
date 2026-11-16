import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import ReservationModal from '@/components/ReservationModal.vue';
import { expectNoA11yViolations } from '../setup';

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/composables/useReservations', () => ({
  useReservations: () => ({
    bookings: { value: [] },
    downloadCalendarFile: vi.fn(),
  }),
}));

describe('Flux 3 : Réservation & Confirmation de Billet (A11y Modale)', () => {
  const mockProps = {
    show: true,
    bookingId: 'book-123456789',
    movieTitle: 'Oppenheimer',
    startsAt: '2026-10-31T19:30:00.000Z',
    hall: 'Salle 1 - IMAX Laser',
  };

  it('doit respecter le motif WAI-ARIA Modal Dialog (role dialog, aria-modal, aria-labelledby)', async () => {
    const { container } = render(ReservationModal, {
      props: mockProps,
    });

    // Rôle dialog et aria-modal="true"
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    // aria-labelledby pointant sur le titre de la modale
    const labelledById = dialog.getAttribute('aria-labelledby');
    expect(labelledById).toBeTruthy();
    const titleElement = container.querySelector(`#${labelledById}`);
    expect(titleElement).toBeTruthy();
    expect(titleElement?.textContent).toMatch(/réservation/i);

    // Bouton de fermeture avec étiquette accessible
    const closeBtn = screen.getByRole('button', {
      name: /fermer la confirmation/i,
    });
    expect(closeBtn).toBeTruthy();

    // Audit axe-core
    await expectNoA11yViolations(container);
  });

  it('doit se fermer lors de la pression de la touche Échap (Escape)', async () => {
    let closed = false;
    render(ReservationModal, {
      props: mockProps,
      attrs: {
        onClose: () => { closed = true; },
      },
    });

    await userEvent.keyboard('{Escape}');
    expect(closed).toBe(true);
  });

  it('doit maintenir un piège de focus (Focus Trap) à l\'intérieur de la modale', async () => {
    render(ReservationModal, {
      props: mockProps,
    });

    const dialog = screen.getByRole('dialog');
    const focusableElements = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    expect(focusableElements.length).toBeGreaterThan(1);

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Simuler le focus sur le dernier élément puis Tab
    lastElement.focus();
    expect(document.activeElement).toBe(lastElement);

    // Un événement Tab depuis le dernier élément doit boucler sur le premier
    lastElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(firstElement);

    // Un événement Shift+Tab depuis le premier élément doit boucler sur le dernier
    firstElement.focus();
    firstElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    expect(document.activeElement).toBe(lastElement);
  });
});

