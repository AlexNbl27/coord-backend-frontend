import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import TicketPdfButton from '@/components/TicketPdfButton.vue';
import {
  type BrowserAdapter,
  FALLBACK,
  fetchTicketPdf,
  filenameFrom,
  MESSAGES,
  OFFLINE,
  openTicketPdf,
  REVOKE_AFTER_MS,
  saveTicketPdf,
  TicketPdfError,
  ticketPdfUrl
} from '@/services/ticketPdf';
import { expectNoA11yViolations } from './setup';

function problemResponse(status: number, detail = 'Technical detail') {
  return new Response(JSON.stringify({ status, detail, message: detail }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' }
  });
}

function pdfResponse(filename = 'ticket-42.pdf') {
  return new Response('%PDF-1.4', {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`
    }
  });
}

function fakeBrowser() {
  const scheduled: Array<() => void> = [];
  const tab = {
    show: vi.fn(),
    close: vi.fn()
  };
  const browser: BrowserAdapter = {
    openTab: vi.fn(() => tab),
    createObjectURL: vi.fn(() => 'blob:http://localhost:3001/fake-uuid'),
    revokeObjectURL: vi.fn(),
    later: vi.fn((fn: () => void) => {
      scheduled.push(fn);
    }),
    save: vi.fn()
  };
  return { browser, tab, scheduled };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Contrat', () => {
  it('construit l\'URL inline et attachment', () => {
    expect(ticketPdfUrl('bk-42')).toBe('/api/bookings/bk-42/ticket.pdf');
    expect(ticketPdfUrl('bk-42', true)).toBe('/api/bookings/bk-42/ticket.pdf?download=true');
  });

  it('lit le nom de fichier dans Content-Disposition', () => {
    expect(filenameFrom('attachment; filename="ticket-bk42.pdf"', 'bk42')).toBe('ticket-bk42.pdf');
  });

  it('construit un nom neutre si Content-Disposition est absent', () => {
    expect(filenameFrom(null, 'bk-42')).toBe('ticket-bk-42.pdf');
  });
});

describe('Récupération du PDF', () => {
  it('envoie credentials same-origin et Accept application/pdf, application/problem+json', async () => {
    const fetchMock = vi.fn().mockResolvedValue(pdfResponse('ticket-42.pdf'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTicketPdf('42');

    expect(fetchMock).toHaveBeenCalledWith('/api/bookings/42/ticket.pdf', {
      credentials: 'same-origin',
      headers: { Accept: 'application/pdf, application/problem+json' }
    });
    expect(result.filename).toBe('ticket-42.pdf');
  });

  it.each([401, 404, 409])('traduit %i en phrase utilisateur', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(status, 'détail technique')));

    await expect(fetchTicketPdf('42')).rejects.toEqual(
      new TicketPdfError(MESSAGES[status], status)
    );
  });

  it('extrait detail du ProblemDetail pour une erreur 500', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(500, 'Police manquante')));

    await expect(fetchTicketPdf('42')).rejects.toEqual(
      new TicketPdfError('Police manquante', 500)
    );
  });

  it('traduit une panne réseau en message hors ligne', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(fetchTicketPdf('42')).rejects.toEqual(new TicketPdfError(OFFLINE, 0));
  });

  it('refuse une réponse 200 qui n\'est pas un PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<html><body>Login</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })
      )
    );

    await expect(fetchTicketPdf('42')).rejects.toEqual(new TicketPdfError(FALLBACK, 200));
  });
});

describe('Affichage, mémoire et composant', () => {
  it('ouvre l\'onglet avant await et révoque l\'URL blob après délai', async () => {
    const { browser, tab, scheduled } = fakeBrowser();
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
      )
    );

    const promise = openTicketPdf('42', browser);
    expect(browser.openTab).toHaveBeenCalledTimes(1);

    resolveFetch(pdfResponse());
    await promise;

    expect(tab.show).toHaveBeenCalledWith('blob:http://localhost:3001/fake-uuid');
    expect(browser.later).toHaveBeenCalledWith(expect.any(Function), REVOKE_AFTER_MS);
    scheduled.forEach((fn) => fn());
    expect(browser.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:3001/fake-uuid');
  });

  it('referme l\'onglet vide en cas d\'erreur', async () => {
    const { browser, tab } = fakeBrowser();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(problemResponse(409, 'cancelled')));

    await expect(openTicketPdf('42', browser)).rejects.toThrow(MESSAGES[409]);
    expect(tab.close).toHaveBeenCalledTimes(1);
  });

  it('télécharge avec download=true et browser.save', async () => {
    const { browser } = fakeBrowser();
    const fetchMock = vi.fn().mockResolvedValue(pdfResponse('ticket-42.pdf'));
    vi.stubGlobal('fetch', fetchMock);

    await saveTicketPdf('42', browser);

    expect(fetchMock).toHaveBeenCalledWith('/api/bookings/42/ticket.pdf?download=true', expect.any(Object));
    expect(browser.save).toHaveBeenCalledWith(expect.anything(), 'ticket-42.pdf');
  });

  it('affiche les états Prêt, Préparation…, Erreur (role="alert") et passe axe-core', async () => {
    const { browser } = fakeBrowser();
    let rejectFetch!: (err: unknown) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject;
        })
      )
    );

    const { container } = render(TicketPdfButton, {
      props: {
        bookingId: '42',
        movieTitle: 'Interstellar',
        browser
      }
    });

    const openBtn = screen.getByRole('button', { name: /ouvrir mon billet pdf/i });
    expect(openBtn.textContent).toContain('Mon billet (PDF)');
    await expectNoA11yViolations(container);

    await userEvent.click(openBtn);
    expect(openBtn.textContent).toContain('Préparation…');
    expect((openBtn as HTMLButtonElement).disabled).toBe(true);
    expect(openBtn.getAttribute('aria-busy')).toBe('true');

    rejectFetch(new TypeError('offline'));
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toContain(OFFLINE);
    });
    expect((openBtn as HTMLButtonElement).disabled).toBe(false);
  });
});
