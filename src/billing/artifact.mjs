import { buildInvoiceDocument } from './document-profile.mjs';

function pdfText(value) {
  return String(value ?? '')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"');
}

function money(minor, currency) {
  const value = Number(minor || 0) / 100;
  return `${new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency || ''}`.trim();
}

function workHours(minutes) {
  return `${new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(minutes || 0) / 60)} t`;
}
function documentLines(document) {
  const vatPercent = Number(document.tax?.rateBps || 0) / 100;
  const seller = document.seller || {};
  const buyer = document.buyer || {};
  const lines = [
    'FAKTURA',
    seller.name || '',
    seller.postalAddress || '',
    seller.registrationId ? `CVR: ${seller.registrationId}` : '',
    seller.email ? `E-mail: ${seller.email}` : '',
    seller.phone ? `Telefon: ${seller.phone}` : '',
    '',
    `Faktura nr. ${document.number}`,
    `Fakturadato: ${document.issueDate}`,
    `Forfald: ${document.dueDate}`,
    '',
    `Kunde: ${buyer.name || ''}`,
    buyer.postalAddress ? `Adresse: ${buyer.postalAddress}` : '',
    buyer.email ? `E-mail: ${buyer.email}` : '',
    '',
    'Ydelser',
  ].filter((line, index, all) => line !== '' || all[index - 1] !== '');

  for (const line of document.lines || []) {
    const netUnitMinor = Math.round((line.grossUnitPriceMinor * 10000) / (10000 + (document.tax?.rateBps || 0)));
    lines.push(`${line.serviceLabel} · leveret ${line.deliveryDate} · ${workHours(line.workMinutes)} · enhedspris ekskl. moms ${money(netUnitMinor, document.currency)}`);
    lines.push(`  Linje i alt inkl. moms: ${money(line.grossMinor, document.currency)}`);
    if (line.discountMinor) lines.push(`  Rabat ${line.discountPercent}%: -${money(line.discountMinor, document.currency)}`);
  }
  lines.push(
    '',
    `Momsgrundlag: ${money(document.totals.netMinor, document.currency)}`,
    `Momssats: ${vatPercent}%`,
    `Moms: ${money(document.totals.taxMinor, document.currency)}`,
    `I alt: ${money(document.totals.grossMinor, document.currency)}`,
  );
  if (document.payment?.text) lines.push('', `Betaling: ${document.payment.text}`);
  return lines;
}

function paginate(lines, perPage = 30) {
  const pages = [];
  for (let index = 0; index < lines.length; index += perPage) {
    pages.push(lines.slice(index, index + perPage));
  }
  return pages.length ? pages : [[]];
}

function pageStream(lines, pageNumber, pageCount) {
  const streamLines = ['BT', '/F1 11 Tf', '50 790 Td'];
  lines.forEach((line, index) => {
    if (index > 0) streamLines.push('0 -22 Td');
    streamLines.push(`(${pdfText(line)}) Tj`);
  });
  streamLines.push('ET');
  streamLines.push('BT', '/F1 9 Tf', '500 28 Td', `(Side ${pageNumber} af ${pageCount}) Tj`, 'ET');
  return streamLines.join('\n');
}

function buildPdf(lines) {
  const pages = paginate(lines);
  const objects = [];
  const pageRefs = [];
  const catalogId = 1;
  const pagesId = 2;
  const fontId = 3;
  let nextId = 4;
  const pageEntries = [];

  pages.forEach((pageLines, index) => {
    const pageId = nextId++;
    const contentId = nextId++;
    const stream = pageStream(pageLines, index + 1, pages.length);
    pageRefs.push(`${pageId} 0 R`);
    pageEntries.push({ pageId, contentId, stream });
  });

  objects[catalogId] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId] = `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${pages.length} >>`;
  objects[fontId] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  for (const entry of pageEntries) {
    objects[entry.pageId] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${entry.contentId} 0 R >>`;
    objects[entry.contentId] = `<< /Length ${Buffer.byteLength(entry.stream, 'latin1')} >>\nstream\n${entry.stream}\nendstream`;
  }

  let output = '%PDF-1.4\n';
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = Buffer.byteLength(output, 'latin1');
    output += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(output, 'latin1');
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    output += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
  }
  output += `trailer\n<< /Size ${objects.length} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(output, 'latin1');
}

export function renderInvoicePdf({ billing, invoiceId } = {}) {
  const document = buildInvoiceDocument({ billing, invoiceId });
  return {
    contentType: 'application/pdf',
    filename: `invoice-${String(document.number).replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`,
    body: buildPdf(documentLines(document)),
  };
}
