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
/**
 * Project a manual invoice from arbitrary line items (no visit binding).
 * Each line must carry integer quantity, unitPriceMinor and optional discountPercent.
 * All arithmetic stays in integer minor units to avoid floating-point drift.
 */
export function projectManualInvoice({ currency, lines = [], taxRateBps = 0 } = {}) {
  if (!currency || !/^[A-Z]{3}$/.test(currency)) throw new TypeError('currency is required');
  requireInteger(taxRateBps, 'taxRateBps');
  if (taxRateBps < 0) throw new RangeError('taxRateBps must be non-negative');
  if (!Array.isArray(lines) || lines.length === 0) throw new TypeError('at least one manual line is required');

  const normalized = lines.map((line, index) => {
    const description = String(line?.description || '').trim();
    if (!description) throw new TypeError(`line ${index} description is required`);
    const quantity = Number(line?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new RangeError(`line ${index} quantity must be a positive integer`);
    const unitPriceMinor = Number(line?.unitPriceMinor);
    if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) throw new RangeError(`line ${index} unitPriceMinor must be a non-negative integer`);
    const discountPercent = line?.discountPercent ?? 0;
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      throw new RangeError(`line ${index} discountPercent must be between 0 and 100`);
    }
    if (quantity > Number.MAX_SAFE_INTEGER / Math.max(unitPriceMinor, 1)) {
      throw new RangeError(`line ${index} amount exceeds safe integer range`);
    }
    const grossMinor = quantity * unitPriceMinor;
    if (!Number.isSafeInteger(grossMinor)) {
      throw new RangeError(`line ${index} gross amount exceeds safe integer range`);
    }
    const discountMinor = Math.round((grossMinor * discountPercent) / 100);
    return {
      description,
      quantity,
      unitPriceMinor,
      discountPercent,
      grossMinor,
      discountMinor,
      totalGrossMinor: grossMinor - discountMinor,
    };
  });

  const subtotalGrossMinor = normalized.reduce((sum, line) => sum + line.grossMinor, 0);
  const discountMinor = normalized.reduce((sum, line) => sum + line.discountMinor, 0);
  const totalGrossMinor = subtotalGrossMinor - discountMinor;
  const totalNetMinor = Math.round((totalGrossMinor * 10000) / (10000 + taxRateBps));
  const taxMinor = totalGrossMinor - totalNetMinor;

  return {
    currency,
    taxRateBps,
    lines: normalized,
    subtotalGrossMinor,
    discountMinor,
    totalGrossMinor,
    totalNetMinor,
    taxMinor,
  };
}

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
