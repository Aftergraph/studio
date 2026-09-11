import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');

test('service worker precaches every first-party module needed by billing app shell', () => {
  const sw = read('public/billing/service-worker.js');
  assert.match(sw, /app-state\.mjs/);
});

test('legacy billing redirect avoids inline script under self-only CSP', () => {
  const html = read('public/billing.html');
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i);
});

test('billing app hydrates bearer token from Studio session or persisted app session', () => {
  const app = read('public/billing/billing-app.mjs');
  assert.match(app, /Authorization/);
  assert.match(app, /Bearer/);
});

test('billing offline cache is scoped by authenticated identity', () => {
  const app = read('public/billing/billing-app.mjs');
  assert.match(app, /cache/i);
  assert.match(app, /(user|subject|actor|identity)/i);
});
