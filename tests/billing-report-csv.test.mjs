import test from 'node:test';
import assert from 'node:assert/strict';

// Replicate reportToCsv from server/billing-server.mjs for isolated unit testing.
// This is the exact implementation from lines 48-83.

function reportToCsv(report) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [];
  if (report.type === 'revenue-by-customer') {
    rows.push(['Kunde', 'Kunde-ID', 'Fakturaer', 'Betalt (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.customerName, r.customerId, r.invoiceCount, r.totalPaidMinor].map(esc).join(','));
    }
  } else if (report.type === 'revenue-by-period') {
    rows.push(['Periode', 'Beløb (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.period, r.amountMinor].map(esc).join(','));
    }
  } else if (report.type === 'vat-overview') {
    rows.push(['Netto (øre)', 'Moms (øre)', 'Brutto (øre)'].map(esc).join(','));
    rows.push([report.totalNetMinor, report.totalTaxMinor, report.totalGrossMinor].map(esc).join(','));
  } else if (report.type === 'days-to-pay') {
    rows.push(['Faktura', 'Kunde', 'Dage', 'Beløb (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.invoiceNumber || r.invoiceId, r.customerName, r.days, r.amountMinor].map(esc).join(','));
    }
  } else if (report.type === 'outstanding-aging') {
    rows.push(['Aldersgruppe', 'Label', 'Antal', 'Beløb (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.bucket, r.label, r.count, r.amountMinor].map(esc).join(','));
    }
  } else {
    rows.push(['Type', 'Fejl'].map(esc).join(','));
    rows.push([report.type, report.error || ''].map(esc).join(','));
  }
  return '\uFEFF' + rows.join('\n'); // BOM for Excel Danish locale
}

// #13: Unit tests for reportToCsv()

test('reportToCsv includes UTF-8 BOM prefix', () => {
  const csv = reportToCsv({ type: 'vat-overview', totalNetMinor: 100, totalTaxMinor: 25, totalGrossMinor: 125 });
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with BOM');
});

test('reportToCsv escapes fields containing commas', () => {
  const csv = reportToCsv({
    type: 'revenue-by-customer',
    rows: [{ customerName: 'Acme, Inc.', customerId: 'c1', invoiceCount: 1, totalPaidMinor: 5000 }],
  });
  assert.ok(csv.includes('"Acme, Inc."'), 'Comma in field must be quoted');
});

test('reportToCsv escapes fields containing double quotes', () => {
  const csv = reportToCsv({
    type: 'revenue-by-customer',
    rows: [{ customerName: 'Say "Hello"', customerId: 'c2', invoiceCount: 2, totalPaidMinor: 8000 }],
  });
  assert.ok(csv.includes('"Say ""Hello"""'), 'Double quotes must be escaped as ""');
});

test('reportToCsv escapes fields containing newlines', () => {
  const csv = reportToCsv({
    type: 'revenue-by-customer',
    rows: [{ customerName: 'Line1\nLine2', customerId: 'c3', invoiceCount: 1, totalPaidMinor: 3000 }],
  });
  assert.ok(csv.includes('"Line1\nLine2"'), 'Newline in field must be quoted');
});

test('reportToCsv handles null values as empty strings', () => {
  const csv = reportToCsv({
    type: 'revenue-by-customer',
    rows: [{ customerName: null, customerId: 'c4', invoiceCount: 0, totalPaidMinor: 0 }],
  });
  const lines = csv.split('\n');
  // Data line should have empty first field
  assert.ok(lines[1].startsWith(',c4,'));
});

test('reportToCsv renders revenue-by-customer correctly', () => {
  const csv = reportToCsv({
    type: 'revenue-by-customer',
    rows: [
      { customerName: 'Alpha', customerId: 'c1', invoiceCount: 3, totalPaidMinor: 15000 },
    ],
  });
  assert.ok(csv.includes('Kunde,Kunde-ID,Fakturaer,Betalt (øre)'));
  assert.ok(csv.includes('Alpha,c1,3,15000'));
});

test('reportToCsv renders revenue-by-period correctly', () => {
  const csv = reportToCsv({
    type: 'revenue-by-period',
    rows: [{ period: '2026-09', amountMinor: 50000 }],
  });
  assert.ok(csv.includes('Periode,Beløb (øre)'));
  assert.ok(csv.includes('2026-09,50000'));
});

test('reportToCsv renders vat-overview correctly', () => {
  const csv = reportToCsv({
    type: 'vat-overview',
    totalNetMinor: 100000,
    totalTaxMinor: 25000,
    totalGrossMinor: 125000,
  });
  assert.ok(csv.includes('Netto (øre),Moms (øre),Brutto (øre)'));
  assert.ok(csv.includes('100000,25000,125000'));
});

test('reportToCsv renders days-to-pay correctly', () => {
  const csv = reportToCsv({
    type: 'days-to-pay',
    rows: [{ invoiceNumber: '101', invoiceId: 'i1', customerName: 'Alpha', days: 14, amountMinor: 8000 }],
  });
  assert.ok(csv.includes('Faktura,Kunde,Dage,Beløb (øre)'));
  assert.ok(csv.includes('101,Alpha,14,8000'));
});

test('reportToCsv renders outstanding-aging correctly', () => {
  const csv = reportToCsv({
    type: 'outstanding-aging',
    rows: [{ bucket: '0-30', label: 'Current', count: 5, amountMinor: 25000 }],
  });
  assert.ok(csv.includes('Aldersgruppe,Label,Antal,Beløb (øre)'));
  assert.ok(csv.includes('0-30,Current,5,25000'));
});

test('reportToCsv handles unknown report type with error row', () => {
  const csv = reportToCsv({ type: 'bogus-type', error: 'unknown_report_type' });
  assert.ok(csv.includes('Type,Fejl'));
  assert.ok(csv.includes('bogus-type,unknown_report_type'));
});

test('reportToCsv handles empty rows array', () => {
  const csv = reportToCsv({ type: 'revenue-by-customer', rows: [] });
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, 1); // BOM+header on single line, no data rows
});
