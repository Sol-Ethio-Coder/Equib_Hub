import type { Response } from 'express';
import PDFDocument from 'pdfkit';

export type Table = { filename: string; title: string; subtitle: string; columns: string[]; rows: (string | number)[][] };

const csvCell = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stop spreadsheet formula injection
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// The built-in PDF font only covers Latin text; other scripts (e.g. Amharic) are shown as "?" in PDFs. CSV keeps everything.
const latin = (v: unknown) => String(v ?? '').replace(/[^\u0020-\u00ff]/g, '?');

export function sendTable(res: Response, fmt: 'csv' | 'pdf', t: Table) {
  if (fmt === 'csv') {
    const lines = [t.columns, ...t.rows].map((r) => r.map(csvCell).join(','));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${t.filename}.csv"`);
    return res.send('\uFEFF' + lines.join('\n')); // BOM so Excel reads Unicode names correctly
  }
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: t.columns.length > 6 ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${t.filename}.pdf"`);
  doc.pipe(res);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0E6F64').text('EquibHub');
  doc.fontSize(18).fillColor('#111').text(latin(t.title));
  doc.font('Helvetica').fontSize(10).fillColor('#555').text(latin(t.subtitle));
  doc.moveDown();
  const left = 40, width = doc.page.width - 80, cw = width / t.columns.length;
  let y = doc.y;
  const row = (cells: (string | number)[], bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    const h = Math.max(...cells.map((c) => doc.heightOfString(latin(c), { width: cw - 6 }))) + 8;
    if (y + h > doc.page.height - 60) { doc.addPage(); y = 40; }
    doc.fillColor(bold ? '#0E6F64' : '#111');
    cells.forEach((c, i) => doc.text(latin(c), left + i * cw, y + 4, { width: cw - 6 }));
    doc.moveTo(left, y + h).lineTo(left + width, y + h).lineWidth(0.5).strokeColor('#d9e2df').stroke();
    y += h;
  };
  row(t.columns, true);
  if (t.rows.length === 0) row(['No records for this selection.', ...t.columns.slice(1).map(() => '')], false);
  t.rows.forEach((r) => row(r, false));
  doc.font('Helvetica').fontSize(8).fillColor('#888').text(`Generated ${new Date().toISOString().slice(0, 10)} · EquibHub is a record-keeping tool, not a bank.`, left, y + 14, { width });
  doc.end();
}
