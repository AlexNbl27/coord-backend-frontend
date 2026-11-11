import { describe, it, expect, vi } from 'vitest';
import { ref } from 'vue';
import { render, screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import LoginView from '@/views/LoginView.vue';
import { expectNoA11yViolations } from '../setup';

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useRoute: () => ({ path: '/login', query: {} }),
}));

vi.mock('@/composables/useSession', () => ({
  useSession: () => ({
    login: vi.fn(async () => null),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    setupMfa: vi.fn(async () => ({
      secret: 'JBSWY3DPEHPK3PXP',
      otpauthUri: 'otpauth://totp/CineSlot:admin%40cineslot.test?secret=JBSWY3DPEHPK3PXP&issuer=CineSlot',
    })),
    verifyMfa: vi.fn(),
    isAdminPlane: true,
    googleEnabled: ref(false),
    mfaEnabled: ref(false),
    mfaVerifiedAt: ref(null),
    initSession: vi.fn(async () => {}),
  }),
}));

describe('Flux MFA admin (A11y)', () => {
  it('première connexion : QR code TOTP généré dans la page, secret affiché en secours', async () => {
    const { container } = render(LoginView);
    await userEvent.type(screen.getByLabelText('Email'), 'admin@cineslot.test');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'motdepasse-admin');
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    const qr = await waitFor(() => screen.getByAltText(/QR code de configuration TOTP/i));
    expect(qr.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    expect(screen.getByText('JBSWY3DPEHPK3PXP')).toBeTruthy();
    expect(screen.getByLabelText(/Code TOTP/)).toBeTruthy();
    await expectNoA11yViolations(container);
  });
});
