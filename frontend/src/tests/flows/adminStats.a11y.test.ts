import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/vue';
import AdminStatsView from '@/views/AdminStatsView.vue';
import { apiClient } from '@/services/apiClient';
import { expectNoA11yViolations } from '../setup';

vi.mock('@/services/apiClient', () => ({ apiClient: { get: vi.fn() } }));

const STATS = {
  groupBy: 'movie',
  rows: [
    { key: 'm1', label: 'Dune', booked: 4, cancelled: 1, seats: 9, cancellationRate: 0.25 },
    { key: 'm2', label: 'Inception', booked: 2, cancelled: 0, seats: 3, cancellationRate: 0 },
  ],
  days: [
    { day: '2026-11-16', booked: 2, cancelled: 0, seats: 5, cancellationRate: 0 },
    { day: '2026-11-17', booked: 4, cancelled: 1, seats: 7, cancellationRate: 0.25 },
  ],
};

describe('AdminStatsView : tableau de bord des réservations (A11y)', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('expose chaque graphique sous forme de tableau de données accessible', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: STATS });
    const { container } = render(AdminStatsView);

    const topTable = await screen.findByRole('table', { name: /classement par film/i });
    expect(within(topTable).getByRole('rowheader', { name: 'Dune' })).toBeTruthy();
    expect(within(topTable).getByText('25.0 %')).toBeTruthy();

    const daysTable = screen.getByRole('table', { name: /données quotidiennes/i });
    expect(within(daysTable).getAllByRole('row')).toHaveLength(3);

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('16.7 %')).toBeTruthy();
    expect(apiClient.get).toHaveBeenCalledWith('/api/admin/stats/bookings', { params: { groupBy: 'movie' } });

    await expectNoA11yViolations(container);
  });

  it('annonce un refus 403 via role="alert"', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(Object.assign(new Error('Forbidden'), { response: { status: 403 } }));
    render(AdminStatsView);
    expect((await screen.findByRole('alert')).textContent).toMatch(/accès refusé/i);
  });
});
