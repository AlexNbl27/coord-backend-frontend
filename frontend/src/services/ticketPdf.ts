export const REVOKE_AFTER_MS = 60_000;

export const MESSAGES: Record<number, string> = {
  401: 'Votre session a expiré. Reconnectez-vous.',
  404: 'Ce billet est introuvable.',
  409: 'Cette réservation est annulée : son billet n\'est plus disponible.',
  500: 'La génération du billet a échoué. Réessayez dans un instant.'
};

export const FALLBACK = 'Impossible de récupérer le billet PDF pour le moment.';
export const OFFLINE = 'Connexion impossible. Vérifiez votre réseau et réessayez.';

export class TicketPdfError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'TicketPdfError';
    this.status = status;
  }
}

export interface BrowserTab {
  show(url: string): void;
  close(): void;
}

export interface BrowserAdapter {
  openTab(): BrowserTab;
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
  later(fn: () => void, ms: number): void;
  save(blob: Blob, filename: string): void;
}

export const realBrowser: BrowserAdapter = {
  openTab(): BrowserTab {
    const win = window.open('', '_blank', 'noopener');
    return {
      show(url: string) {
        if (win) {
          win.location.href = url;
        } else {
          window.open(url, '_blank', 'noopener');
        }
      },
      close() {
        if (win && !win.closed) {
          win.close();
        }
      }
    };
  },
  createObjectURL(blob: Blob): string {
    return URL.createObjectURL(blob);
  },
  revokeObjectURL(url: string): void {
    URL.revokeObjectURL(url);
  },
  later(fn: () => void, ms: number): void {
    window.setTimeout(fn, ms);
  },
  save(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

export function ticketPdfUrl(bookingId: string, download = false): string {
  const base = `/api/bookings/${encodeURIComponent(bookingId)}/ticket.pdf`;
  return download ? `${base}?download=true` : base;
}

export function filenameFrom(contentDisposition: string | null, bookingId: string): string {
  if (contentDisposition) {
    const match = /filename="?([^";]+)"?/i.exec(contentDisposition);
    if (match?.[1]) {
      return match[1].trim();
    }
  }
  const safeId = bookingId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 12) || 'billet';
  return `ticket-${safeId}.pdf`;
}

async function messageOf(response: Response): Promise<string> {
  const known = MESSAGES[response.status];
  if (response.status !== 500 && known) {
    return known;
  }

  try {
    const data = await response.json() as { detail?: string; message?: string };
    if (typeof data?.detail === 'string' && data.detail.trim().length > 0) {
      return data.detail;
    }
    if (typeof data?.message === 'string' && data.message.trim().length > 0) {
      return data.message;
    }
  } catch {
    // Ignore non-JSON error body
  }

  return known ?? FALLBACK;
}

export async function fetchTicketPdf(
  bookingId: string,
  download = false
): Promise<{ blob: Blob; filename: string }> {
  let response: Response;
  try {
    response = await fetch(ticketPdfUrl(bookingId, download), {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/pdf, application/problem+json'
      }
    });
  } catch {
    throw new TicketPdfError(OFFLINE, 0);
  }

  if (!response.ok) {
    throw new TicketPdfError(await messageOf(response), response.status);
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/pdf')) {
    throw new TicketPdfError(FALLBACK, response.status);
  }

  const blob = await response.blob();
  const filename = filenameFrom(response.headers.get('Content-Disposition'), bookingId);
  return { blob, filename };
}

export async function openTicketPdf(
  bookingId: string,
  browser: BrowserAdapter = realBrowser
): Promise<void> {
  const tab = browser.openTab();
  try {
    const { blob } = await fetchTicketPdf(bookingId, false);
    const url = browser.createObjectURL(blob);
    tab.show(url);
    browser.later(() => browser.revokeObjectURL(url), REVOKE_AFTER_MS);
  } catch (err) {
    tab.close();
    throw err;
  }
}

export async function saveTicketPdf(
  bookingId: string,
  browser: BrowserAdapter = realBrowser
): Promise<void> {
  const { blob, filename } = await fetchTicketPdf(bookingId, true);
  browser.save(blob, filename);
}
