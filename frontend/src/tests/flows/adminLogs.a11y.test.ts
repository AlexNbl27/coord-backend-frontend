import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import AdminLogsView from '@/views/AdminLogsView.vue';
import { expectNoA11yViolations } from '../setup';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('@/services/apiClient', () => ({ apiClient: { get } }));

function reservationPage(page: number) {
  return {
    page,
    limit: 25,
    total: 30,
    totalPages: 2,
    items: [
      {
        id: `log-${page}`,
        at: '2026-11-17T10:00:00.000Z',
        action: page === 1 ? 'BOOKED' : 'REJECTED_FULL',
        cinemaSlug: 'lumiere',
        slotId: 'slot-1',
        movieId: 'movie-1',
        bookingId: 'b5d1c6a0-1111-2222-3333-444455556666',
        userId: 'u-1',
        quantity: 2,
        traceId: page === 1 ? TRACE_ID : null,
      },
    ],
  };
}

const auditPage = {
  page: 1,
  limit: 25,
  total: 1,
  totalPages: 1,
  items: [
    {
      seq: 7,
      at: '2026-11-17T09:00:00.000Z',
      actor: { id: 'root', role: 'SUPER_ADMIN' },
      action: 'ACCESS_DENIED',
      target: { type: 'route', id: 'POST /api/slots/reset', cinemaSlug: 'lumiere' },
      result: 'DENIED',
      hash: 'abc',
    },
  ],
};

beforeEach(() => {
  get.mockReset();
  get.mockImplementation((url: string, config: { params: Record<string, string | number> }) => {
    if (url === '/api/admin/audit') return Promise.resolve({ data: auditPage });
    return Promise.resolve({ data: reservationPage(Number(config.params.page)) });
  });
});

const loaded = () => screen.findByText(/^\s*30 entrée\(s\)\s*$/);
const reservationTable = () => screen.getByRole('region', { name: /tableau du journal des réservations/i });

const reservationCalls = () => get.mock.calls.filter(([url]) => url === '/api/admin/logs/reservations');

describe('Flux Admin : journaux de réservation et audit (A11y)', () => {
  it('affiche des tableaux sémantiques avec en-têtes, légende et lien Jaeger, sans violation axe', async () => {
    const { container } = render(AdminLogsView);

    await loaded();
    const tables = screen.getAllByRole('table');
    expect(tables).toHaveLength(2);
    expect(within(tables[0]).getAllByRole('columnheader')).toHaveLength(9);
    expect(container.querySelector('caption')?.textContent).toMatch(/journal des réservations/i);

    const traceLink = screen.getByRole('link', { name: /ouvrir la trace 4bf92f35.*jaeger/i });
    expect(traceLink.getAttribute('href')).toBe(`http://localhost:16686/trace/${TRACE_ID}`);
    expect(traceLink.getAttribute('target')).toBe('_blank');
    expect(traceLink.getAttribute('rel')).toContain('noopener');

    expect(within(reservationTable()).getByText('Réservée')).toBeTruthy();
    expect(screen.getByText('ACCESS_DENIED')).toBeTruthy();
    expect(screen.getAllByRole('status')[0].textContent).toMatch(/30 entrée/);

    await expectNoA11yViolations(container);
  });

  it('chaque filtre possède un libellé et la recherche se lance au clavier', async () => {
    render(AdminLogsView);
    await loaded();

    for (const name of [/cinéma \(slug\)/i, /film \(identifiant\)/i, /séance \(identifiant\)/i, /^action$/i, /^du$/i, /^au$/i]) {
      expect(screen.getAllByLabelText(name).length).toBeGreaterThan(0);
    }

    const cinema = screen.getAllByLabelText(/cinéma \(slug\)/i)[0];
    await userEvent.click(cinema);
    await userEvent.keyboard('rex');
    await userEvent.selectOptions(screen.getAllByLabelText(/^action$/i)[0], 'REJECTED_FULL');
    cinema.focus();
    await userEvent.keyboard('{Enter}');

    await waitFor(() => expect(reservationCalls()).toHaveLength(2));
    const params = reservationCalls()[1][1].params;
    expect(params).toMatchObject({ page: 1, limit: 25, cinema: 'rex', action: 'REJECTED_FULL' });
    expect(params).not.toHaveProperty('movie');
  });

  it('la pagination est atteignable au clavier et désactive les bornes', async () => {
    render(AdminLogsView);
    await loaded();

    const nav = screen.getByRole('navigation', { name: /pagination du journal des réservations/i });
    const previous = within(nav).getByRole('button', { name: /précédente/i }) as HTMLButtonElement;
    const next = within(nav).getByRole('button', { name: /suivante/i }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    next.focus();
    await userEvent.keyboard('{Enter}');

    await within(reservationTable()).findByText('Refusée (complet)');
    expect(reservationCalls().at(-1)?.[1].params.page).toBe(2);
    expect(within(nav).getByText(/page 2 sur 2/i)).toBeTruthy();
    expect(next.disabled).toBe(true);
    expect(previous.disabled).toBe(false);
  });

  it('annonce une erreur 403 via role="alert"', async () => {
    get.mockImplementation(() => Promise.reject({ response: { status: 403 } }));
    const { container } = render(AdminLogsView);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0].textContent).toMatch(/pas accès/i);
    await expectNoA11yViolations(container);
  });
});
