import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AdminCinemasView from '../views/AdminCinemasView.vue';
import { apiClient } from '../services/apiClient';
import { useSession } from '../composables/useSession';
import router from '../router';

describe('AdminCinemasView & role guard', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.restoreAllMocks();
  });

  it('lists cinemas, toggles status, and requires exact slug to confirm delete', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: [
        { slug: 'lyon', name: 'Lyon', address: '1 rue A', city: 'Lyon', status: 'ACTIVE' }
      ]
    } as any);
    const patchSpy = vi.spyOn(apiClient, 'patch').mockResolvedValue({
      data: { slug: 'lyon', status: 'DISABLED' }
    } as any);
    const deleteSpy = vi.spyOn(apiClient, 'delete').mockResolvedValue({
      data: { slug: 'lyon', status: 'DELETED' }
    } as any);

    const wrapper = mount(AdminCinemasView, { attachTo: document.body });
    await flushPromises();

    expect(getSpy).toHaveBeenCalledWith('/api/admin/cinemas', { withCredentials: true });
    expect(wrapper.text()).toContain('Lyon');
    expect(wrapper.text()).toContain('ACTIVE');

    const switchBtn = wrapper.find('button[role="switch"]');
    await switchBtn.trigger('click');
    await flushPromises();
    expect(patchSpy).toHaveBeenCalledWith(
      '/api/admin/cinemas/lyon/status',
      { status: 'DISABLED' },
      { withCredentials: true }
    );

    const deleteBtn = wrapper.findAll('button').find((b) => b.text() === 'Supprimer');
    await deleteBtn!.trigger('click');
    await flushPromises();

    const confirmBtn = Array.from(document.body.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Confirmer la suppression'
    ) as HTMLButtonElement;
    expect(confirmBtn).toBeTruthy();
    expect(confirmBtn.disabled).toBe(true);

    const confirmInput = document.body.querySelector('#confirm-slug-input') as HTMLInputElement;
    confirmInput.value = 'wrong';
    confirmInput.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(confirmBtn.disabled).toBe(true);

    confirmInput.value = 'lyon';
    confirmInput.dispatchEvent(new Event('input'));
    await flushPromises();
    expect(confirmBtn.disabled).toBe(false);

    confirmBtn.click();
    await flushPromises();
    expect(deleteSpy).toHaveBeenCalledWith('/api/admin/cinemas/lyon', { withCredentials: true });
    wrapper.unmount();
  });

  it('blocks non-SUPER_ADMIN users from /admin/cinemas via router guard', async () => {
    const { currentUser } = useSession();
    const spectator = { id: 'u1', name: 'Ada', email: 'ada@cineslot.test', role: 'SPECTATOR' as const };
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { authenticated: true, user: spectator } } as any);

    currentUser.value = spectator;
    await router.push('/admin/cinemas');
    await router.isReady();
    expect(router.currentRoute.value.name).toBe('home');

    currentUser.value = { id: 'sa1', name: 'SA', email: 'sa@cineslot.test', role: 'SUPER_ADMIN' };
    await router.push('/admin/cinemas');
    expect(router.currentRoute.value.name).toBe('admin-cinemas');
  });
});
