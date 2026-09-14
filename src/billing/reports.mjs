// Billing reports computation — pure functions, no side effects.
// Types: revenue-by-customer, revenue-by-period, vat-overview, days-to-pay, outstanding-aging
// All monetary values are integer minors (øre). Currencies are not combined.

export function periodKey(dateStr, granularity) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  if (granularity === 'day') return dateStr.slice(0, 10);
  if (granularity === 'week') {
    const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((d - jan1) / 86400000) + 1;
    const week = Math.ceil((dayOfYear + jan1.getUTCDay()) / 7);
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
  }
  // month (default)
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function inRange(dateStr, dateFrom, dateTo) {
  if (!dateStr) return false;
  const ds = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  if (dateFrom && ds < dateFrom) return false;
  if (dateTo && ds > dateTo) return false;
  return true;
}

const VALID_TYPES = ['revenue-by-customer', 'revenue-by-period', 'vat-overview', 'days-to-pay', 'outstanding-aging'];

export function computeReport({ invoices, customers, type, dateFrom, dateTo, granularity }) {
  if (!VALID_TYPES.includes(type)) {
    return { type, error: 'unknown_report_type', generatedAt: new Date().toISOString() };
  }
  const customerMap = new Map((customers || []).map((c) => [c.id, c]));
  const invList = Array.isArray(invoices) ? invoices : [];
  const now = new Date().toISOString();
  const gran = granularity || 'month';

  if (type === 'revenue-by-customer') {
    const byCustomer = new Map();
    for (const inv of invList) {
      if (inv.status === 'void') continue;
      const paid = (inv.payments || []).reduce((s, p) => s + (p.amountMinor || 0), 0);
      if (paid <= 0) continue;
      const latestPayment = (inv.payments || []).reduce((latest, p) => (!latest || p.paidAt > latest.paidAt ? p : latest), null);
      if (!inRange(latestPayment?.paidAt, dateFrom, dateTo)) continue;
      const entry = byCustomer.get(inv.customerId) || { customerId: inv.customerId, customerName: customerMap.get(inv.customerId)?.name || inv.customerId, totalPaidMinor: 0, invoiceCount: 0 };
      entry.totalPaidMinor += paid;
      entry.invoiceCount++;
      byCustomer.set(inv.customerId, entry);
    }
    const rows = [...byCustomer.values()].sort((a, b) => b.totalPaidMinor - a.totalPaidMinor);
    return { type, dateFrom, dateTo, granularity: gran, currency: 'DKK', rows, generatedAt: now };
  }

  if (type === 'revenue-by-period') {
    const byPeriod = new Map();
    for (const inv of invList) {
      if (inv.status === 'void') continue;
      for (const p of (inv.payments || [])) {
        if (!inRange(p.paidAt, dateFrom, dateTo)) continue;
        const key = periodKey(p.paidAt, gran) || 'unknown';
        byPeriod.set(key, (byPeriod.get(key) || 0) + (p.amountMinor || 0));
      }
    }
    const rows = [...byPeriod.entries()].map(([period, amountMinor]) => ({ period, amountMinor })).sort((a, b) => a.period.localeCompare(b.period));
    return { type, dateFrom, dateTo, granularity: gran, currency: 'DKK', rows, generatedAt: now };
  }

  if (type === 'vat-overview') {
    let totalNetMinor = 0;
    let totalTaxMinor = 0;
    let totalGrossMinor = 0;
    for (const inv of invList) {
      if (inv.status === 'void') continue;
      if (!inRange(inv.issuedAt || inv.createdAt, dateFrom, dateTo)) continue;
      totalGrossMinor += inv.totalGrossMinor || 0;
      totalNetMinor += inv.totalNetMinor || 0;
      totalTaxMinor += inv.taxMinor || 0;
    }
    return { type, dateFrom, dateTo, granularity: gran, currency: 'DKK', totalNetMinor, totalTaxMinor, totalGrossMinor, generatedAt: now };
  }

  if (type === 'days-to-pay') {
    const rows = [];
    for (const inv of invList) {
      if (inv.status === 'void') continue;
      const paid = (inv.payments || []).reduce((s, p) => s + (p.amountMinor || 0), 0);
      if (paid <= 0 || paid < (inv.totalGrossMinor || 0)) continue;
      const issuedAt = inv.issuedAt || inv.createdAt;
      if (!issuedAt) continue;
      if (!inRange(issuedAt, dateFrom, dateTo)) continue;
      const lastPayment = (inv.payments || []).reduce((latest, p) => (!latest || p.paidAt > latest.paidAt ? p : latest), null);
      if (!lastPayment) continue;
      const days = Math.max(0, Math.round((new Date(lastPayment.paidAt) - new Date(issuedAt)) / 86400000));
      rows.push({ invoiceId: inv.id, invoiceNumber: inv.number || null, customerName: customerMap.get(inv.customerId)?.name || inv.customerId, days, amountMinor: inv.totalGrossMinor || 0 });
    }
    rows.sort((a, b) => b.days - a.days);
    const avgDays = rows.length ? Math.round(rows.reduce((s, r) => s + r.days, 0) / rows.length) : 0;
    return { type, dateFrom, dateTo, granularity: gran, currency: 'DKK', averageDays: avgDays, rows, generatedAt: now };
  }

  if (type === 'outstanding-aging') {
    const buckets = {
      current: { label: 'Ikke forfalden', count: 0, amountMinor: 0 },
      '1-30': { label: '1–30 dage', count: 0, amountMinor: 0 },
      '31-60': { label: '31–60 dage', count: 0, amountMinor: 0 },
      '61-90': { label: '61–90 dage', count: 0, amountMinor: 0 },
      '90+': { label: 'Over 90 dage', count: 0, amountMinor: 0 },
    };
    const todayMs = new Date(now).getTime();
    for (const inv of invList) {
      if (inv.status === 'void') continue;
      const paid = (inv.payments || []).reduce((s, p) => s + (p.amountMinor || 0), 0);
      const outstanding = (inv.totalGrossMinor || 0) - paid;
      if (outstanding <= 0) continue;
      const dueDate = inv.dueDate || inv.issuedAt || inv.createdAt;
      if (!dueDate) continue;
      const overdueDays = Math.max(0, Math.round((todayMs - new Date(dueDate).getTime()) / 86400000));
      let bucket = 'current';
      if (overdueDays > 90) bucket = '90+';
      else if (overdueDays > 60) bucket = '61-90';
      else if (overdueDays > 30) bucket = '31-60';
      else if (overdueDays > 0) bucket = '1-30';
      buckets[bucket].count++;
      buckets[bucket].amountMinor += outstanding;
    }
    const rows = Object.entries(buckets).map(([key, val]) => ({ bucket: key, ...val }));
    const totalOutstandingMinor = rows.reduce((s, r) => s + r.amountMinor, 0);
    return { type, dateFrom, dateTo, granularity: gran, currency: 'DKK', totalOutstandingMinor, rows, generatedAt: now };
  }

  return { type, error: 'unknown_report_type', generatedAt: now };
}
