import test from 'node:test';
import assert from 'node:assert/strict';
import { esc, today, formatDate, formatSyncTime, formatMoney, formatWorkMinutes } from '../src/billing/lib/format.mjs';

// ── Integration: billing-app.mjs consumes extracted format module ────────────

test('billing-app.mjs imports format functions from lib/format.mjs', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/billing/billing-app.mjs', import.meta.url), 'utf8');
  assert.match(source, /from\s+['"]\.\/lib\/format\.mjs['"]/);
  assert.match(source, /import\s*\{[^}]*esc[^}]*\}/);
  assert.match(source, /import\s*\{[^}]*formatMoney[^}]*\}/);
});

test('billing-app.mjs no longer contains inline format function bodies', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../src/billing/billing-app.mjs', import.meta.url), 'utf8');
  // The original function declarations should be gone
  assert.doesNotMatch(source, /function\s+esc\s*\(/);
  assert.doesNotMatch(source, /function\s+formatMoney\s*\(/);
  assert.doesNotMatch(source, /function\s+formatDate\s*\(/);
  assert.doesNotMatch(source, /function\s+formatWorkMinutes\s*\(/);
});

// ── esc ──────────────────────────────────────────────────────────────────────

test('esc escapes HTML special characters', () => {
  assert.equal(esc('&'), '&amp;');
  assert.equal(esc('<'), '&lt;');
  assert.equal(esc('>'), '&gt;');
  assert.equal(esc('"'), '&quot;');
  assert.equal(esc("'"), '&#039;');
});

test('esc handles nullish and non-string values', () => {
  assert.equal(esc(null), '');
  assert.equal(esc(undefined), '');
  assert.equal(esc(42), '42');
  assert.equal(esc(0), '0');
});

test('esc preserves safe strings unchanged', () => {
  assert.equal(esc('Hello World'), 'Hello World');
  assert.equal(esc('abc123'), 'abc123');
});

// ── today ────────────────────────────────────────────────────────────────────

test('today returns YYYY-MM-DD format', () => {
  const result = today();
  assert.match(result, /^\d{4}-\d{2}-\d{2}$/);
});

// ── formatDate ───────────────────────────────────────────────────────────────

test('formatDate formats valid date in da-DK locale', () => {
  const result = formatDate('2024-03-15T10:00:00Z', 'da-DK');
  assert.ok(result.includes('2024'));
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('formatDate returns fallback for invalid date', () => {
  // Invalid Date → NaN → falls back to String(value||'').slice(0,10) || 'Ukendt dato'
  assert.equal(formatDate('not-a-date'), 'not-a-date');
  // null → new Date(null) → epoch (valid date) → formatted normally
  const nullResult = formatDate(null);
  assert.ok(nullResult.includes('1970'), `null parses as epoch: ${nullResult}`);
  // empty string → new Date('') → NaN → fallback
  assert.equal(formatDate(''), 'Ukendt dato');
});

test('formatDate parses YYYY-MM-DD as valid date and formats it', () => {
  // '2024-03-15' is a valid ISO date string → parsed successfully → formatted
  const result = formatDate('2024-03-15', 'da-DK');
  assert.ok(result.includes('2024'));
  assert.ok(result.includes('mar'));
});

// ── formatSyncTime ───────────────────────────────────────────────────────────

test('formatSyncTime formats valid datetime', () => {
  const result = formatSyncTime('2024-03-15T14:30:00Z', 'da-DK');
  assert.ok(typeof result === 'string' && result.length > 0);
  assert.notEqual(result, 'ukendt tidspunkt');
});

test('formatSyncTime returns fallback for truly invalid datetime', () => {
  // 'invalid' parses to NaN → fallback
  assert.equal(formatSyncTime('not-a-date-at-all'), 'ukendt tidspunkt');
  // null → new Date(null) → epoch (valid) → formatted, not fallback
  const nullResult = formatSyncTime(null);
  assert.notEqual(nullResult, 'ukendt tidspunkt');
});

// ── formatMoney ──────────────────────────────────────────────────────────────

test('formatMoney formats integer minor units as currency', () => {
  const result = formatMoney(12345, 'DKK', 'da-DK');
  assert.ok(result.includes('123,45'));
  assert.ok(result.includes('kr'));
});

test('formatMoney treats non-integer minor as zero', () => {
  assert.equal(formatMoney(12.5, 'DKK', 'da-DK'), formatMoney(0, 'DKK', 'da-DK'));
});

test('formatMoney defaults to DKK and da-DK', () => {
  const result = formatMoney(100);
  // 100 minor = 1.00 DKK; da-DK uses comma decimal and kr. suffix
  assert.ok(result.includes('1,00') || result.includes('kr'), `Unexpected format: ${result}`);
});

// ── formatWorkMinutes ────────────────────────────────────────────────────────

test('formatWorkMinutes formats integer minutes as hours', () => {
  const result = formatWorkMinutes(90, 'da-DK');
  assert.ok(result.includes('1,5'));
  assert.ok(result.includes('arbejdstimer'));
});

test('formatWorkMinutes returns fallback for non-integer', () => {
  assert.equal(formatWorkMinutes(12.5), 'Arbejdstid mangler');
  assert.equal(formatWorkMinutes(null), 'Arbejdstid mangler');
});
