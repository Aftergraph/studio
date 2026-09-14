import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');

test('billing standalone app declares installable product metadata', async () => {
  const html = await text('billing/index.html');
  assert.match(html, /<title>Ledger — Aftergraph<\/title>/i);
  assert.match(html, /name="viewport"[^>]*viewport-fit=cover/i);
  assert.match(html, /rel="manifest"[^>]*manifest\.webmanifest/i);
  assert.match(html, /apple-mobile-web-app-capable/i);
  assert.match(html, /theme-color/i);
});

test('billing manifest is scoped to the standalone billing app', async () => {
  const raw = await text('billing/manifest.webmanifest');
  const manifest = JSON.parse(raw);
  assert.equal(manifest.name, 'Ledger by Aftergraph');
  assert.equal(manifest.short_name, 'Ledger');
  assert.equal(manifest.start_url, '/billing/');
  assert.equal(manifest.scope, '/billing/');
  assert.equal(manifest.display, 'standalone');
  assert.ok(Array.isArray(manifest.icons));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '192x192'));
  assert.ok(manifest.icons.some((icon) => icon.sizes === '512x512'));
});

test('billing service worker never queues or caches consequential mutations', async () => {
  const source = await text('billing/sw.js');
  assert.match(source, /\/api\/v1\/billing/);
  assert.match(source, /request\.method\s*!==\s*['"]GET['"]/);
  assert.match(source, /fetch\(request\)/);
  assert.doesNotMatch(source, /sync\.register|SyncManager|backgroundSync|mutationQueue|writeQueue/i);
});

test('static server resolves trailing slash app routes to index files', async () => {
  const source = await text('server/static-handler.mjs');
  assert.match(source, /endsWith\(['"]\/['"]\)/);
  assert.match(source, /index\.html/);
});

test('billing compatibility route redirects to canonical standalone app preserving location suffixes', async () => {
  const html = await text('billing.html');
  assert.match(html, /\/billing\//);
  assert.match(html, /legacy-redirect\.mjs/);
  const redirect = await text('src/billing/legacy-redirect.mjs');
  assert.match(redirect, /location\.search/);
  assert.match(redirect, /location\.hash/);
  assert.doesNotMatch(html, /id="billing-app"/);
});

test('billing reconnect queues a refresh instead of dropping it while another refresh is busy', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /refreshPending/);
  assert.match(source, /if \(state\.busy\) \{ state\.refreshPending = true; return; \}/);
  assert.match(source, /if \(state\.refreshPending\)/);
});

test('billing cached fallback schedules a bounded live resync retry', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /retryTimer/);
  assert.match(source, /scheduleRetry/);
  assert.match(source, /clearRetry/);
  assert.match(source, /if \(usedCache && state\.online\) scheduleRetry\(\)/);
});

test('billing offline fallback is memory-only and has no mutation replay API', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /adoptMemorySnapshot/);
  assert.doesNotMatch(source, /aftergraph\.billing\.read-cache|writeReadCache|readReadCache|sanitizeBillingForCache/);
  assert.match(source, /Offline/);
  assert.match(source, /senest synkroniseret/);
  assert.doesNotMatch(source, /replayMutation|flushMutation|mutationQueue|writeQueue/i);
});

test('billing issue and deliver invoice require confirmation dialog before API call', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /showConfirmDialog/);
  assert.match(source, /Udsted faktura\? Denne handling kan ikke fortrydes\./);
  assert.match(source, /Send faktura til kunden\? Denne handling kan ikke fortrydes\./);
  // Confirm that showConfirmDialog is awaited before client.issueInvoice
  assert.match(source, /await showConfirmDialog\([^)]+\);[\s\S]*?if \(!confirmed\) return;[\s\S]*?client\.issueInvoice/);
  // Confirm that showConfirmDialog is awaited before client.deliverInvoice
  assert.match(source, /await showConfirmDialog\([^)]+\);[\s\S]*?if \(!confirmed\) return;[\s\S]*?client\.deliverInvoice/);
  // Confirm cancel flow: early return prevents reaching client call
  assert.match(source, /if \(!confirmed\) return;/);
});
