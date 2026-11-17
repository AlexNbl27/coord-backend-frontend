import { trace, SpanStatusCode } from '@opentelemetry/api';
import { getTenantModels } from '../tenancy/index.js';
import { createTicketView } from '../utils/ticketFormatters.js';
import { renderTicketPdf } from './ticketPdfRenderer.js';

const tracer = trace.getTracer('cineslot-api');

export const NOT_FOUND_MESSAGE = 'Ce billet est introuvable.';
export const CANCELLED_MESSAGE = 'Cette réservation est annulée : son billet n\'est plus disponible.';

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * Returns a neutral PDF filename containing only the booking identifier.
 */
export function ticketFilename(bookingId) {
  const safeId = String(bookingId ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
  const shortId = safeId.slice(0, 12) || 'billet';
  return `ticket-${shortId}.pdf`;
}

/**
 * Validates ownership and booking status before rendering the PDF ticket.
 */
export async function buildTicket(ownerId, bookingId, deps = {}) {
  const findBooking = deps.findBookingById || ((id) => getTenantModels(deps.tenant?.db).Booking.findById(id).lean());
  const renderPdf = deps.renderPdf || renderTicketPdf;

  return tracer.startActiveSpan('cineslot.ticket.pdf.generate', async (span) => {
    span.setAttribute('cineslot.booking.id', String(bookingId));
    try {
      const booking = await findBooking(bookingId);
      if (!booking || booking.ownerId !== ownerId) {
        throw createHttpError(404, NOT_FOUND_MESSAGE);
      }

      if (booking.status !== 'CONFIRMED') {
        throw createHttpError(409, CANCELLED_MESSAGE);
      }

      const view = createTicketView(booking);
      const pdf = await renderPdf(view);

      span.setAttribute('cineslot.status', booking.status);
      span.setAttribute('cineslot.pdf.bytes', pdf.length);

      return {
        pdf,
        filename: ticketFilename(booking._id),
        view
      };
    } catch (err) {
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}
