import test from 'node:test';
import assert from 'node:assert/strict';
import { formatMoney, eurosToCents } from '../src/economy/currency.mjs';

test('formats EUR cents in da-DK', () => {
  assert.equal(formatMoney(840, { currency: 'EUR', locale: 'da-DK' }), '8,40 €');
});
test('formats USD cents in en-US', () => {
  assert.equal(formatMoney(123456, { currency: 'USD', locale: 'en-US' }), '$1,234.56');
});
test('falls back for unknown currency', () => {
  assert.equal(formatMoney(250, { currency: 'EURO', locale: 'en-US' }), 'EURO 2.50');
});
test('handles negative and large values', () => {
  assert.equal(formatMoney(-599, { currency: 'EUR', locale: 'da-DK' }), '-5,99 €');
  assert.equal(formatMoney(100000000, { currency: 'EUR', locale: 'da-DK' }), '1.000.000,00 €');
});
test('rejects non-integer cents', () => {
  assert.throws(() => formatMoney(8.4, { currency: 'EUR', locale: 'da-DK' }), TypeError);
});
test('eurosToCents converts fixture floats at the boundary', () => {
  assert.equal(eurosToCents(8.4), 840);
  assert.equal(eurosToCents(0.1 + 0.2), 30);
});
