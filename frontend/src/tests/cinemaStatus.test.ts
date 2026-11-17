import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/vue';
import { setActivePinia, createPinia } from 'pinia';
import CinemaStatusBanner from '@/components/CinemaStatusBanner.vue';
import SlotCard from '@/components/SlotCard.vue';
import { useCurrentCinema } from '@/composables/useCurrentCinema';
import { expectNoA11yViolations } from './setup';

const SLOT = {
  id: 'slot-1',
  startsAt: '2026-12-01T19:30:00.000Z',
  status: 'AVAILABLE' as const,
  version: 1,
  movieTitle: 'Dune',
  hall: 'Salle 1',
  capacity: 40,
  availableSeats: 40,
};

describe('Cinéma désactivé', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const { cinema, setCinemaStatus } = useCurrentCinema();
    cinema.value = { slug: 'cine-bellecour', name: 'Ciné Bellecour', address: 'Place Bellecour', city: 'Lyon', status: 'ACTIVE' };
    setCinemaStatus('ACTIVE');
  });

  it('pas de bannière quand le cinéma est actif', () => {
    render(CinemaStatusBanner);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('bannière nommant le cinéma dès que le statut passe à DISABLED', async () => {
    useCurrentCinema().setCinemaStatus('DISABLED');
    const { container } = render(CinemaStatusBanner);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Ciné Bellecour');
    expect(banner.textContent).toContain("n'accepte plus de réservations");
    expect(screen.getByRole('link', { name: /Choisir un autre cinéma/ })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('la carte de séance ne propose plus de réserver', () => {
    useCurrentCinema().setCinemaStatus('DISABLED');
    render(SlotCard, { props: { slot: SLOT, sseConnected: true } });
    expect(screen.getByText('Réservations suspendues')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Réserver une place/ })).toBeNull();
  });
});
