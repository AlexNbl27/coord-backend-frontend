import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, screen } from '@testing-library/vue';
import Navbar from '@/components/Navbar.vue';
import { expectNoA11yViolations } from '../setup';
import { useSession } from '@/composables/useSession';

vi.mock('@/services/tenant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/tenant')>()),
  currentHostContext: () => ({ plane: 'admin', slug: null }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn(), currentRoute: ref({ meta: {} }) }),
  useRoute: () => ({ path: '/admin/stats' }),
  RouterLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
}));

vi.mock('@/composables/useAbTest', () => ({ useAbTest: () => ({ variant: ref('A') }) }));

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
  useReservations: () => ({ activeBookingsCount: ref(0) }),
}));

describe('Header du portail admin', () => {
  it('ne montre que les pages admin, sans billets ni A/B', async () => {
    useSession().currentUser.value = { id: 'u-0', name: 'Root', email: 'root@cineslot.test', role: 'SUPER_ADMIN' };
    const { container } = render(Navbar);
    const nav = screen.getByRole('navigation', { name: /navigation principale/i });

    const labels = [...nav.querySelectorAll('.md\\:flex a')].map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Cinémas', 'Journaux', 'Statistiques']);
    expect(screen.queryByText('Films')).toBeNull();
    expect(screen.queryByRole('link', { name: /mes billets/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /métriques du test a\/b/i })).toBeNull();
    expect(screen.getByText('Portail admin')).toBeTruthy();
    await expectNoA11yViolations(container);
    useSession().currentUser.value = null;
  });
});
