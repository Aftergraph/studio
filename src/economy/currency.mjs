// P1-009 (HC-D): single shared integer-cent money formatter.
// Domain truth is integer cents (V7.4 ledger); euro-float fixtures convert
// at the display boundary via eurosToCents so precision loss is explicit.
const SYMBOL_TO_CODE = Object.freeze({ '€': 'EUR', $: 'USD', 'kr': 'DKK', '£': 'GBP' });

export function currencyCode(input) {
  if (!input) return 'EUR';
  const code = String(input).trim();
  return SYMBOL_TO_CODE[code] || code;
}

export function eurosToCents(euros) {
  return Math.round(Number(euros || 0) * 100);
}

export function formatMoney(amountCents, { currency = 'EUR', locale = 'da-DK' } = {}) {
  if (!Number.isInteger(amountCents)) throw new TypeError('amountCents must be integer cents');
  const code = currencyCode(currency);
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code }).format(amountCents / 100);
  } catch {
    return `${code} ${(amountCents / 100).toFixed(2)}`;
  }
}
