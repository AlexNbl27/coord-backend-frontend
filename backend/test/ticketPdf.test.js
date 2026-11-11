import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderTicketHtml, renderTicketPdf } from '../src/services/ticketPdfRenderer.js';
import { createTicketView } from '../src/utils/ticketFormatters.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TARGET_DIR = path.resolve(__dirname, '../target');

const SAMPLE_BOOKING = {
  _id: '42a8f0c1-1111-4444-8888-123456789abc',
  slotId: 'slot-dune-imax-1',
  ownerId: 'spectator-1',
  ownerName: 'Hélène Durand',
  movieTitle: 'Dune : Deuxième Partie',
  hall: 'Salle 1 · IMAX Laser',
  address: '14 rue de la Cinémathèque, 69002 Lyon',
  startsAt: '2026-11-24T08:30:00.000Z',
  seat: 'Rangée E · Fauteuil 12',
  status: 'CONFIRMED',
  bookedAt: new Date('2026-11-16T10:25:00.000Z')
};

async function loadPdfDocument(pdfBuffer) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBuffer),
    verbosity: 0
  });
  return loadingTask.promise;
}

async function extractPdfText(pdfDoc) {
  let fullText = '';
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    fullText += `${pageText}\n`;
  }
  return fullText;
}

test('ticketPdfRenderer: generates example PDF, extracts text, accents, A4 page, and structure', async () => {
  const view = createTicketView(SAMPLE_BOOKING);
  assert.equal(view.bookingId, SAMPLE_BOOKING._id, 'QR code payload is the full booking id');
  const pdfBuffer = await renderTicketPdf(view);

  fs.mkdirSync(TARGET_DIR, { recursive: true });
  fs.writeFileSync(path.join(TARGET_DIR, 'ticket-example.pdf'), pdfBuffer);

  const pdfDoc = await loadPdfDocument(pdfBuffer);
  const text = await extractPdfText(pdfDoc);

  // 1. Expected date, Paris time, and movie title
  assert.match(text, /mardi 24 novembre 2026/i);
  assert.match(text, /9 h 30/);
  assert.match(text, /Dune : Deuxième Partie/);

  // 2. French accents preserved by embedded DejaVu Sans fonts
  assert.ok(text.includes('Hélène Durand'), `Expected "Hélène Durand" in PDF text, got: ${text}`);
  assert.ok(text.includes('Rangée E · Fauteuil 12'));

  // 3. Single A4 page (595 x 842 pt)
  assert.equal(pdfDoc.numPages, 1);
  const firstPage = await pdfDoc.getPage(1);
  const [, , width, height] = firstPage.view;
  assert.equal(Math.round(width), 595);
  assert.equal(Math.round(height), 842);

  // 4. Accessibility: tagged PDF structure tree, French language, and title metadata
  const structTree = await firstPage.getStructTree();
  assert.ok(structTree, 'PDF must contain a StructureTreeRoot for accessibility');
  const metadata = await pdfDoc.getMetadata();
  assert.equal(metadata.info.Title, `Billet ${view.reference}`);
  assert.equal(metadata.info.Author, 'CinéSlot');
});

test('ticketPdfRenderer: escapes HTML special characters in template', () => {
  const view = createTicketView({
    ...SAMPLE_BOOKING,
    ownerName: 'Hélène <script>alert(1)</script> Durand'
  });
  const html = renderTicketHtml(view);

  assert.ok(html.includes('<html lang="fr">'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
});

test('ticketPdfRenderer: fails with RenderingFailed when embedded fonts are missing', async () => {
  const view = createTicketView(SAMPLE_BOOKING);
  await assert.rejects(
    () => renderTicketPdf(view, { fontsDir: path.join(TARGET_DIR, 'non-existent-fonts') }),
    (err) => err.name === 'RenderingFailed'
  );
});
