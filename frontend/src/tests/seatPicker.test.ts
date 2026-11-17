import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/vue';
import { flushPromises } from '@vue/test-utils';
import { defineComponent, h, ref } from 'vue';
import SeatPicker from '@/components/SeatPicker.vue';
import { apiClient } from '@/services/apiClient';
import { pickBestSeats, type SeatLayout } from '@/services/seatMap';
import { expectNoA11yViolations } from './setup';

const LAYOUT: SeatLayout = {
  capacity: 24,
  cols: 10,
  rows: [
    { label: 'A', count: 10 },
    { label: 'B', count: 10 },
    { label: 'C', count: 4 },
  ],
};

function mountPicker(quantity: number, taken: string[] = [], disabled = false) {
  vi.spyOn(apiClient, 'get').mockResolvedValue({ data: { slotId: 's-1', version: 1, layout: LAYOUT, taken } } as any);
  const selected = ref<string[]>([]);
  const Host = defineComponent({
    setup: () => () => h(SeatPicker, {
      slotId: 's-1',
      quantity,
      disabled,
      modelValue: selected.value,
      'onUpdate:modelValue': (v: string[]) => { selected.value = v; },
    }),
  });
  const utils = render(Host);
  return { ...utils, selected };
}

const seat = (name: RegExp) => screen.getByRole('button', { name });

describe('pickBestSeats (front)', () => {
  it('place un bloc contigu au centre, en évitant les places prises', () => {
    expect(pickBestSeats(LAYOUT, [], 2)).toEqual(['B5', 'B6']);
    expect(pickBestSeats(LAYOUT, ['B5'], 2)).toEqual(['B6', 'B7']);
    expect(pickBestSeats(LAYOUT, [], 25)).toBeNull();
  });
});

describe('SeatPicker', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('charge le plan, centre la dernière rangée et passe axe-core', async () => {
    const { container } = mountPicker(2, ['A1']);
    await flushPromises();

    expect(apiClient.get).toHaveBeenCalledWith('/api/slots/s-1/seats', expect.any(Object));
    expect(screen.getAllByRole('button', { name: /^Rangée/ })).toHaveLength(24);
    expect(seat(/Rangée A, fauteuil 1, occupé/).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('group', { name: 'Rangée C' })).toBeTruthy();
    await expectNoA11yViolations(container);
  });

  it('limite la sélection au nombre de billets en remplaçant la plus ancienne', async () => {
    const { selected } = mountPicker(2);
    await flushPromises();

    await fireEvent.click(seat(/Rangée A, fauteuil 3, libre/));
    await fireEvent.click(seat(/Rangée A, fauteuil 4, libre/));
    await fireEvent.click(seat(/Rangée A, fauteuil 5, libre/));
    expect(selected.value).toEqual(['A4', 'A5']);
    expect(seat(/Rangée A, fauteuil 5, sélectionné/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByText(/2 places choisies : A4, A5/)).toBeTruthy();

    await fireEvent.click(seat(/Rangée A, fauteuil 5, sélectionné/));
    expect(selected.value).toEqual(['A4']);
  });

  it('ignore les places occupées et le plan désactivé', async () => {
    const { selected } = mountPicker(1, ['B2']);
    await flushPromises();
    await fireEvent.click(seat(/Rangée B, fauteuil 2, occupé/));
    expect(selected.value).toEqual([]);

    vi.restoreAllMocks();
    const locked = mountPicker(1, [], true);
    await flushPromises();
    await fireEvent.click(screen.getAllByRole('button', { name: /Rangée A, fauteuil 1, libre/ }).at(-1)!);
    expect(locked.selected.value).toEqual([]);
  });

  it('placement automatique au centre', async () => {
    const { selected } = mountPicker(3);
    await flushPromises();
    await fireEvent.click(screen.getByRole('button', { name: 'Placement automatique' }));
    expect(selected.value).toEqual(['B4', 'B5', 'B6']);
  });

  it('navigue au clavier avec un seul fauteuil tabulable', async () => {
    mountPicker(1);
    await flushPromises();

    const tabbable = screen.getAllByRole('button', { name: /^Rangée/ }).filter((b) => b.getAttribute('tabindex') === '0');
    expect(tabbable).toHaveLength(1);

    const start = seat(/Rangée A, fauteuil 5, libre/);
    start.focus();
    await fireEvent.keyDown(start, { key: 'ArrowRight' });
    await flushPromises();
    expect(document.activeElement).toBe(seat(/Rangée A, fauteuil 6, libre/));

    await fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    await flushPromises();
    expect(document.activeElement).toBe(seat(/Rangée B, fauteuil 6, libre/));

    await fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    await flushPromises();
    expect(document.activeElement).toBe(seat(/Rangée C, fauteuil 3, libre/));
  });
});
