import { describe, it, expect, vi } from 'vitest';
import router from '@/router';
import { apiClient } from '@/services/apiClient';
import { useSession } from '@/composables/useSession';

vi.mock('@/services/tenant', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/tenant')>()),
  currentHostContext: () => ({ plane: 'admin', slug: null }),
}));

const SUPER_ADMIN = { id: 'sa1', name: 'SA', email: 'sa@cineslot.test', role: 'SUPER_ADMIN' as const };
const MINUTE = 60 * 1000;

describe('Garde MFA du portail admin (règle du backend)', () => {
  it('TOTP une fois par session, re-vérification < 5 min seulement pour Cinémas', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { authenticated: true, user: SUPER_ADMIN, mfaVerifiedAt: null } } as any);
    const { initSession, mfaVerifiedAt } = useSession();
    await initSession();

    // Jamais vérifié : toute page admin renvoie vers l'étape TOTP
    await router.push('/admin/logs');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.mfa).toBe('1');

    // Vérifié il y a 10 min : journaux et stats restent accessibles après un rechargement
    mfaVerifiedAt.value = Date.now() - 10 * MINUTE;
    await router.push('/admin/logs');
    expect(router.currentRoute.value.name).toBe('admin-logs');
    await router.push('/admin/stats');
    expect(router.currentRoute.value.name).toBe('admin-stats');

    // ... mais Cinémas exige une vérification récente, comme requireRecentMfa côté API
    await router.push('/admin/cinemas');
    expect(router.currentRoute.value.name).toBe('login');
    expect(router.currentRoute.value.query.mfa).toBe('1');

    mfaVerifiedAt.value = Date.now() - MINUTE;
    await router.push('/admin/cinemas');
    expect(router.currentRoute.value.name).toBe('admin-cinemas');
  });
});
