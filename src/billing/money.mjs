function requireInteger(value, name) {
  if (!Number.isInteger(value)) throw new TypeError(`${name} must be an integer`);
  return value;
}

function discountPercentFor(customer, visit) {
  const visitPercent = visit?.actual?.discountPercent;
  const customerPercent = customer?.billing?.discountPercent ?? 0;
  const value = visitPercent ?? customerPercent;
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new RangeError('discountPercent must be between 0 and 100');
  }
  return value;
}

/**
 * Build a deterministic invoice projection from verified actual work minutes.
 * All money values are integer minor units and the supplied rate is gross,
 * inclusive of tax.
 */
export function projectInvoice({ customer, visits = [], taxRateBps = 0 } = {}) {
  if (!customer?.billing) throw new TypeError('customer billing settings are required');
  const rateMinor = requireInteger(customer.billing.rateMinor, 'rateMinor');
  requireInteger(taxRateBps, 'taxRateBps');
  if (rateMinor < 0) throw new RangeError('rateMinor must be non-negative');
  if (taxRateBps < 0) throw new RangeError('taxRateBps must be non-negative');
  if (!customer.billing.currency) throw new TypeError('currency is required');

  const lines = visits.map((visit) => {
    const workMinutes = requireInteger(visit?.actual?.workMinutes, 'workMinutes');
    if (workMinutes < 0) throw new RangeError('workMinutes must be non-negative');
    const grossMinor = Math.round((workMinutes * rateMinor) / 60);
    const discountPercent = discountPercentFor(customer, visit);
    const discountMinor = Math.round((grossMinor * discountPercent) / 100);
    return {
      visitId: visit.id,
      workMinutes,
      rateMinor,
      grossMinor,
      discountPercent,
      discountMinor,
      totalGrossMinor: grossMinor - discountMinor,
    };
  });

  const subtotalGrossMinor = lines.reduce((sum, line) => sum + line.grossMinor, 0);
  const discountMinor = lines.reduce((sum, line) => sum + line.discountMinor, 0);
  const totalGrossMinor = subtotalGrossMinor - discountMinor;
  const totalNetMinor = Math.round((totalGrossMinor * 10000) / (10000 + taxRateBps));
  const taxMinor = totalGrossMinor - totalNetMinor;

  return {
    currency: customer.billing.currency,
    taxRateBps,
    lines,
    subtotalGrossMinor,
    discountMinor,
    totalGrossMinor,
    totalNetMinor,
    taxMinor,
  };
}
