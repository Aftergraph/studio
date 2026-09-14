/**
 * Report routes: /api/v1/billing/reports
 */
import { API_VERSION, readJson, sendJson } from '../http-utils.mjs';
import { assertActorCapability } from '../../src/action-guard.mjs';
import { computeReport } from '../../src/billing/reports.mjs';

const DANGEROUS_CSV_LEAD = /^[=+\-@\t\r]/;
function escCsv(v) {
  if (v == null) return '';
  const s = String(v);
  const dangerous = DANGEROUS_CSV_LEAD.test(s);
  const quoted = /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  return dangerous ? `'${quoted}` : quoted;
}

function reportToCsv(report) {
  const rows = [];
  if (report.type === 'revenue-by-customer') {
    rows.push(['Kunde', 'Kunde-ID', 'Fakturaer', 'Betalt (øre)'].map(escCsv).join(','));
    for (const r of (report.rows || [])) rows.push([r.customerName, r.customerId, r.invoiceCount, r.totalPaidMinor].map(escCsv).join(','));
  } else if (report.type === 'revenue-by-period') {
    rows.push(['Periode', 'Beløb (øre)'].map(escCsv).join(','));
    for (const r of (report.rows || [])) rows.push([r.period, r.amountMinor].map(escCsv).join(','));
  } else if (report.type === 'vat-overview') {
    rows.push(['Netto (øre)', 'Moms (øre)', 'Brutto (øre)'].map(escCsv).join(','));
    rows.push([report.totalNetMinor, report.totalTaxMinor, report.totalGrossMinor].map(escCsv).join(','));
  } else if (report.type === 'days-to-pay') {
    rows.push(['Faktura', 'Kunde', 'Dage', 'Beløb (øre)'].map(escCsv).join(','));
    for (const r of (report.rows || [])) rows.push([r.invoiceNumber || r.invoiceId, r.customerName, r.days, r.amountMinor].map(escCsv).join(','));
  } else if (report.type === 'outstanding-aging') {
    rows.push(['Aldersgruppe', 'Label', 'Antal', 'Beløb (øre)'].map(escCsv).join(','));
    for (const r of (report.rows || [])) rows.push([r.bucket, r.label, r.count, r.amountMinor].map(escCsv).join(','));
  } else {
    rows.push(['Type', 'Fejl'].map(escCsv).join(','));
    rows.push([report.type, report.error || ''].map(escCsv).join(','));
  }
  return '\uFEFF' + rows.join('\n');
}

export function register(router, ctx) {
  const { resolveScope, actorError, users } = ctx;

  router.add('GET', '/api/v1/billing/reports', async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
    catch { throw actorError('forbidden', 403); }
    const params = Object.fromEntries(url.searchParams.entries());
    const type = params.type;
    if (!type) { sendJson(res, 422, { error: 'report_type_required' }); return; }
    const snapshot = store.snapshot();
    const billing = snapshot.billing || {};
    const report = computeReport({
      invoices: billing.invoices || [], customers: billing.customers || [],
      type, dateFrom: params.dateFrom || null, dateTo: params.dateTo || null,
      granularity: params.granularity || 'month',
    });
    if (report.error) { sendJson(res, 422, { error: report.error }); return; }
    const accept = (req.headers.accept || '').toLowerCase();
    if (accept.includes('text/csv')) {
      const csv = reportToCsv(report);
      res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${type}-report.csv"` });
      res.end(csv); return;
    }
    sendJson(res, 200, { version: API_VERSION, report });
  });

  router.add('POST', '/api/v1/billing/reports', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const type = body?.type;
    if (!type) { sendJson(res, 422, { error: 'report_type_required' }); return; }
    const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;
    if (body.dateFrom && !DATE_RE.test(body.dateFrom)) { sendJson(res, 422, { error: 'invalid_date_from' }); return; }
    if (body.dateTo && !DATE_RE.test(body.dateTo)) { sendJson(res, 422, { error: 'invalid_date_to' }); return; }
    const VALID_GRANULARITIES = ['day', 'week', 'month'];
    if (body.granularity && !VALID_GRANULARITIES.includes(body.granularity)) { sendJson(res, 422, { error: 'invalid_granularity' }); return; }
    const snapshot = store.snapshot();
    const billing = snapshot.billing || {};
    const report = computeReport({
      invoices: billing.invoices || [], customers: billing.customers || [],
      type, dateFrom: body.dateFrom || null, dateTo: body.dateTo || null,
      granularity: body.granularity || 'month',
    });
    if (report.error) { sendJson(res, 422, { error: report.error }); return; }
    sendJson(res, 200, { version: API_VERSION, report });
  });
}
