import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ChooseCinemaView from '../views/ChooseCinemaView.vue';
import { apiClient } from '../services/apiClient';
import {
  adminUrl,
  apexUrl,
  isValidSlug,
  parseHostContext,
  planeRedirect,
  tenantUrl,
} from '../services/tenant';

const loc = { protocol: 'http:', hostname: 'cine-a.cineslot.localhost', port: '3001' };

describe('services/tenant', () => {
  it('lit le plan et le slug depuis le nom d’hôte', () => {
    expect(parseHostContext('cine-bellecour.cineslot.localhost')).toEqual({ plane: 'tenant', slug: 'cine-bellecour' });
    expect(parseHostContext('CINE-A.CineSlot.Localhost')).toEqual({ plane: 'tenant', slug: 'cine-a' });
    expect(parseHostContext('admin.cineslot.localhost')).toEqual({ plane: 'admin', slug: null });
    expect(parseHostContext('cineslot.localhost')).toEqual({ plane: 'public', slug: null });
    for (const host of ['localhost', 'evil.com', 'config.cineslot.localhost', 'a--b.cineslot.localhost', 'x.cine-a.cineslot.localhost', 'cineslot.localhost.evil.com']) {
      expect(parseHostContext(host)).toEqual({ plane: 'unknown', slug: null });
    }
  });

  it('valide les slugs comme le backend', () => {
    expect(isValidSlug('cine-bellecour')).toBe(true);
    for (const slug of ['admin', 'ab', 'a--b', 'Cine', '-abc', 'abc-', 'cine_x', 42]) {
      expect(isValidSlug(slug)).toBe(false);
    }
  });

  it('construit les URL de sous-domaines en gardant protocole et port', () => {
    expect(tenantUrl('cine-b', '/slots', loc)).toBe('http://cine-b.cineslot.localhost:3001/slots');
    expect(tenantUrl('cine-b', 'slots', loc)).toBe('http://cine-b.cineslot.localhost:3001/slots');
    expect(apexUrl('/choisir-un-cinema', loc)).toBe('http://cineslot.localhost:3001/choisir-un-cinema');
    expect(adminUrl('/', { ...loc, port: '' })).toBe('http://admin.cineslot.localhost/');
    expect(() => tenantUrl('admin', '/', loc)).toThrow(TypeError);
    expect(() => tenantUrl('evil.com/x', '/', loc)).toThrow(TypeError);
  });

  it('redirige selon le plan', () => {
    const tenant = { plane: 'tenant' as const, slug: 'cine-a' };
    const pub = { plane: 'public' as const, slug: null };
    const admin = { plane: 'admin' as const, slug: null };
    const unknown = { plane: 'unknown' as const, slug: null };

    expect(planeRedirect(tenant, 'slots')).toBeNull();
    expect(planeRedirect(tenant, 'admin-cinemas')).toBe('not-found');
    expect(planeRedirect(tenant, 'choose-cinema')).toBe('home');

    expect(planeRedirect(pub, 'home')).toBe('choose-cinema');
    expect(planeRedirect(pub, 'slots')).toBe('choose-cinema');
    expect(planeRedirect(pub, 'reservations')).toBe('choose-cinema');
    expect(planeRedirect(pub, 'movies')).toBeNull();
    expect(planeRedirect(pub, 'choose-cinema')).toBeNull();
    expect(planeRedirect(pub, 'admin-cinemas')).toBe('not-found');

    expect(planeRedirect(admin, 'admin-cinemas')).toBeNull();
    expect(planeRedirect(admin, 'login')).toBeNull();
    expect(planeRedirect(admin, 'slots')).toBe('admin-cinemas');
    expect(planeRedirect(admin, 'home')).toBe('admin-cinemas');

    expect(planeRedirect(unknown, 'slots')).toBeNull();
  });
});

describe('ChooseCinemaView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('liste les cinémas avec un lien vers leur sous-domaine', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: {
        total: 3,
        data: [
          { slug: 'cine-a', name: 'Ciné A', address: '1 place A', city: 'Lyon', status: 'ACTIVE' },
          { slug: 'cine-b', name: 'Ciné B', address: '2 place B', city: 'Paris', status: 'DISABLED' },
          { slug: 'admin', name: 'Piège', address: 'x', city: 'x', status: 'ACTIVE' },
        ],
      },
    } as any);

    const wrapper = mount(ChooseCinemaView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();

    expect(getSpy).toHaveBeenCalledWith('/api/cinemas', { params: { page: 1, limit: 20 } });
    const links = wrapper.findAll('ul a');
    expect(links).toHaveLength(2);
    const origin = `${window.location.protocol}//`;
    expect(links[0].attributes('href')).toMatch(new RegExp(`^${origin}cine-a\\.cineslot\\.localhost`));
    expect(links[1].text()).toContain('Réservations temporairement suspendues');
    expect(wrapper.text()).not.toContain('Piège');
  });

  it('affiche une erreur si l’annuaire est indisponible', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue({ response: { data: { detail: 'Annuaire indisponible.' } } });
    const wrapper = mount(ChooseCinemaView, { global: { stubs: { RouterLink: RouterLinkStub } } });
    await flushPromises();
    expect(wrapper.find('[role="alert"]').text()).toBe('Annuaire indisponible.');
  });
});
