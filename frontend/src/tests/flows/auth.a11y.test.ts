import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import LoginView from '@/views/LoginView.vue';
import ResetPasswordView from '@/views/ResetPasswordView.vue';
import { expectNoA11yViolations } from '../setup';

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useRoute: () => ({ path: '/login', query: {} }),
  RouterLink: {
    template: '<a :href="to"><slot /></a>',
    props: ['to'],
  },
}));

describe('Flux Authentification (A11y)', () => {
  it('LoginView : champs étiquetés dans les 3 modes, sans violation axe', async () => {
    const { container } = render(LoginView);

    expect(screen.getByLabelText('Email')).toBeTruthy();
    expect(screen.getByLabelText('Mot de passe')).toBeTruthy();
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole('button', { name: /créer un compte/i }));
    expect(screen.getByLabelText('Nom')).toBeTruthy();
    await expectNoA11yViolations(container);

    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }));
    await userEvent.click(screen.getByRole('button', { name: /mot de passe oublié/i }));
    expect(screen.queryByLabelText('Mot de passe')).toBeNull();
    await expectNoA11yViolations(container);
  });

  it('ResetPasswordView : sans token, affiche une alerte accessible', async () => {
    const { container } = render(ResetPasswordView);
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'motdepasse1');
    await userEvent.type(screen.getByLabelText('Confirmer le mot de passe'), 'motdepasse1');
    await userEvent.click(screen.getByRole('button', { name: /changer mon mot de passe/i }));

    expect(screen.getByRole('alert').textContent).toMatch(/invalide ou expiré/i);
    await expectNoA11yViolations(container);
  });
});
