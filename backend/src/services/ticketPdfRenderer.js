import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_FONTS_DIR = path.resolve(__dirname, '../assets/fonts');
const TEMPLATE_PATH = path.resolve(__dirname, '../templates/ticket.html');

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapes HTML special characters so dynamic values remain plain text in the template.
 */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch]);
}

/**
 * Renders the HTML template with escaped TicketView fields.
 */
export function renderTicketHtml(view, templatePath = TEMPLATE_PATH) {
  const template = fs.readFileSync(templatePath, 'utf8');
  return template.replace(/\{\{c\.([a-zA-Z0-9_]+)\}\}/g, (_match, key) => {
    return escapeHtml(view[key] ?? '');
  });
}

function assertEmbeddedFonts(fontsDir) {
  const regularPath = path.join(fontsDir, 'DejaVuSans.ttf');
  const boldPath = path.join(fontsDir, 'DejaVuSans-Bold.ttf');
  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    const error = new Error('RenderingFailed: embedded DejaVu Sans fonts are missing');
    error.name = 'RenderingFailed';
    error.code = 'RenderingFailed';
    throw error;
  }
  return { regularPath, boldPath };
}

function drawQrMatrix(doc, x, y, size, seedText) {
  const cells = 11;
  const cellSize = size / cells;
  let hash = 2166136261;
  for (let i = 0; i < seedText.length; i += 1) {
    hash ^= seedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  const isFinder = (r, c) =>
    (r < 3 && c < 3) || (r < 3 && c >= cells - 3) || (r >= cells - 3 && c < 3);

  doc.save();
  doc.rect(x - 4, y - 4, size + 8, size + 8).fill('#FFFFFF').stroke('#CBD5E1');
  for (let r = 0; r < cells; r += 1) {
    for (let c = 0; c < cells; c += 1) {
      let filled = false;
      if (isFinder(r, c)) {
        const lr = r >= cells - 3 ? r - (cells - 3) : r;
        const lc = c >= cells - 3 ? c - (cells - 3) : c;
        filled = lr === 0 || lr === 2 || lc === 0 || lc === 2 || (lr === 1 && lc === 1);
      } else {
        const bit = ((hash >>> ((r * cells + c) % 24)) ^ (r * 7 + c * 13)) & 1;
        filled = bit === 1;
      }
      if (filled) {
        doc.rect(x + c * cellSize, y + r * cellSize, cellSize, cellSize).fill('#0F172A');
      }
    }
  }
  doc.restore();
}

function drawInfoCard(doc, { x, y, width, height, label, value }) {
  doc.save();
  doc.roundedRect(x, y, width, height, 4).fillAndStroke('#F8FAFC', '#CBD5E1');
  doc.font('DejaVu').fontSize(7.5).fillColor('#475569').text(label, x + 12, y + 10, {
    width: width - 24,
    lineBreak: false
  });
  doc.font('DejaVu-Bold').fontSize(10.5).fillColor('#0F172A').text(value, x + 12, y + 25, {
    width: width - 24,
    height: height - 32
  });
  doc.restore();
}

/**
 * Renders a tagged, A4, single-page PDF ticket with embedded DejaVu Sans fonts.
 */
export async function renderTicketPdf(view, options = {}) {
  const fontsDir = options.fontsDir || DEFAULT_FONTS_DIR;
  const { regularPath, boldPath } = assertEmbeddedFonts(fontsDir);

  // Validate HTML template rendering as part of the document pipeline
  renderTicketHtml(view, options.templatePath);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 45,
        lang: 'fr',
        tagged: true,
        displayTitle: true,
        info: {
          Title: `Billet ${view.reference}`,
          Author: 'CinéSlot',
          Subject: 'Billet officiel de séance de cinéma'
        }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.registerFont('DejaVu', regularPath);
      doc.registerFont('DejaVu-Bold', boldPath);

      const pageWidth = doc.page.width;
      const contentWidth = pageWidth - 90;
      const left = 45;

      const rootStruct = doc.struct('Document');
      doc.addStructure(rootStruct);

      // 1. Header banner
      const headerStruct = doc.struct('Sect', () => {
        doc.save();
        doc.rect(left, 45, contentWidth, 82).fill('#0F172A');
        doc.rect(left, 124, contentWidth, 3).fill('#D97706');

        // Logo badge
        doc.roundedRect(left + 16, 61, 36, 36, 6).fill('#D97706');
        doc.font('DejaVu-Bold').fontSize(15).fillColor('#0F172A').text('CS', left + 16, 70, {
          width: 36,
          align: 'center'
        });

        // Brand title
        doc.font('DejaVu-Bold').fontSize(16).fillColor('#FFFFFF').text('CINÉSLOT', left + 64, 62);
        doc.font('DejaVu').fontSize(9).fillColor('#CBD5E1').text(
          'Cinémathèque & Billetterie officielle',
          left + 64,
          84
        );

        // Right-side status & reference
        doc.font('DejaVu-Bold').fontSize(11).fillColor('#FFFFFF').text('BILLET DE SÉANCE', left, 58, {
          width: contentWidth - 16,
          align: 'right'
        });
        doc.roundedRect(left + contentWidth - 94, 77, 78, 18, 4).fill('#064E3B').stroke('#10B981');
        doc.font('DejaVu-Bold').fontSize(8).fillColor('#6EE7B7').text(
          'CONFIRMÉ',
          left + contentWidth - 94,
          82,
          { width: 78, align: 'center' }
        );
        doc.font('DejaVu').fontSize(8.5).fillColor('#E2E8F0').text(
          `Réf. : ${view.reference}`,
          left,
          101,
          { width: contentWidth - 16, align: 'right' }
        );
        doc.restore();
      });
      rootStruct.add(headerStruct);

      // 2. Main film & screening card
      const movieSection = doc.struct('Sect', () => {
        doc.font('DejaVu-Bold').fontSize(8.5).fillColor('#475569').text('FILM & SÉANCE', left, 148);

        const cardY = 164;
        const cardH = 128;
        doc.save();
        doc.roundedRect(left, cardY, contentWidth, cardH, 5).fillAndStroke('#F8FAFC', '#CBD5E1');
        doc.rect(left, cardY, 5, cardH).fill('#D97706');

        doc.font('DejaVu-Bold').fontSize(17).fillColor('#0F172A').text(view.movieTitle, left + 18, cardY + 16, {
          width: contentWidth - 34
        });

        doc.moveTo(left + 18, cardY + 56).lineTo(left + contentWidth - 16, cardY + 56).stroke('#E2E8F0');

        const halfW = (contentWidth - 36) / 2;
        doc.font('DejaVu').fontSize(8).fillColor('#475569').text('JOUR DE LA SÉANCE', left + 18, cardY + 68);
        doc.font('DejaVu-Bold').fontSize(11.5).fillColor('#0F172A').text(view.day, left + 18, cardY + 84, {
          width: halfW - 10
        });

        doc.font('DejaVu').fontSize(8).fillColor('#475569').text(
          'HORAIRE D\'ACCÈS',
          left + 18 + halfW,
          cardY + 68
        );
        doc.font('DejaVu-Bold').fontSize(12.5).fillColor('#B45309').text(
          `${view.time} (heure de Paris)`,
          left + 18 + halfW,
          cardY + 84,
          { width: halfW }
        );
        doc.restore();
      });
      rootStruct.add(movieSection);

      // 3. Spectator & seat 2x2 grid
      const gridSection = doc.struct('Sect', () => {
        doc.font('DejaVu-Bold').fontSize(8.5).fillColor('#475569').text(
          'INFORMATIONS DU SPECTATEUR & PLACEMENT',
          left,
          314
        );

        const gap = 12;
        const boxW = (contentWidth - gap) / 2;
        const boxH = 62;

        drawInfoCard(doc, {
          x: left,
          y: 330,
          width: boxW,
          height: boxH,
          label: 'TITULAIRE DU BILLET',
          value: view.spectatorName
        });
        drawInfoCard(doc, {
          x: left + boxW + gap,
          y: 330,
          width: boxW,
          height: boxH,
          label: 'SALLE DE PROJECTION',
          value: view.hall
        });
        drawInfoCard(doc, {
          x: left,
          y: 330 + boxH + gap,
          width: boxW,
          height: boxH,
          label: 'PLACE ATTRIBUÉE',
          value: view.seat
        });
        drawInfoCard(doc, {
          x: left + boxW + gap,
          y: 330 + boxH + gap,
          width: boxW,
          height: boxH,
          label: 'ADRESSE DU CINÉMA',
          value: view.address
        });
      });
      rootStruct.add(gridSection);

      // 4. Detachable control stub
      const stubSection = doc.struct('Sect', () => {
        const cutY = 492;
        doc.save();
        doc.dash(5, { space: 4 });
        doc.moveTo(left, cutY).lineTo(left + contentWidth, cutY).stroke('#94A3B8');
        doc.undash();
        doc.restore();

        const stubY = 514;
        doc.font('DejaVu-Bold').fontSize(8.5).fillColor('#475569').text(
          'TALON DE CONTRÔLE À L\'ENTRÉE',
          left,
          stubY
        );

        doc.font('DejaVu').fontSize(9.5).fillColor('#1E293B').text(
          '• Présentez ce billet (sur mobile ou imprimé) 15 minutes avant le début de la séance.',
          left,
          stubY + 22,
          { width: contentWidth - 115 }
        );
        doc.font('DejaVu').fontSize(9.5).fillColor('#1E293B').text(
          '• Ce document officiel fait foi au contrôle d\'accès de la salle.',
          left,
          stubY + 52,
          { width: contentWidth - 115 }
        );
        doc.font('DejaVu').fontSize(8.5).fillColor('#475569').text(
          `• Émis le ${view.issuedOn} (heure de Paris)`,
          left,
          stubY + 80,
          { width: contentWidth - 115 }
        );

        const qrSize = 78;
        const qrX = left + contentWidth - qrSize - 6;
        const qrY = stubY + 12;
        drawQrMatrix(doc, qrX, qrY, qrSize, `${view.reference}:${view.seat}`);
        doc.font('DejaVu-Bold').fontSize(8).fillColor('#0F172A').text(
          view.reference,
          qrX - 4,
          qrY + qrSize + 8,
          { width: qrSize + 8, align: 'center' }
        );
      });
      rootStruct.add(stubSection);

      // 5. Footer
      const footerStruct = doc.struct('P', () => {
        const footerY = doc.page.height - 62;
        doc.save();
        doc.moveTo(left, footerY - 10).lineTo(left + contentWidth, footerY - 10).stroke('#E2E8F0');
        doc.font('DejaVu').fontSize(8).fillColor('#64748B').text(
          'CinéSlot · Document officiel qui fait foi',
          left,
          footerY
        );
        doc.font('DejaVu').fontSize(8).fillColor('#64748B').text(
          'CinéSlot · page 1 sur 1',
          left,
          footerY,
          { width: contentWidth, align: 'right' }
        );
        doc.restore();
      });
      rootStruct.add(footerStruct);

      rootStruct.end();
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
