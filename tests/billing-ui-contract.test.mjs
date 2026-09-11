import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('billing app is a focused accessible Aftergraph surface with human work queues', async () => {
  const html = await text('billing/index.html');
  assert.match(html, /<html[^>]*lang="da"/i);
  assert.match(html, /<main[^>]*id="billing-app"/i);
  assert.match(html, /data-view="inbox"/);
  assert.match(html, /data-view="ready"/);
  assert.match(html, /data-view="waiting"/);
  assert.match(html, /data-view="needs_info"/);
  assert.match(html, /data-view="invoiced"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-label="Faktureringsnavigation"/);
  assert.match(html, /id="billing-review"/);
  assert.doesNotMatch(html, /https?:\/\/[^"']+\.(?:js|css)/i);
});

test('billing client exposes only same-origin canonical read and guarded mutation operations', async () => {
  const source = await text('src/billing/browser-client.mjs');
  assert.match(source, /export function createBillingClient/);
  assert.match(source, /\/api\/v1\/billing/);
  assert.match(source, /recordActuals/);
  assert.match(source, /createDraft/);
  assert.match(source, /issueInvoice/);
  assert.match(source, /idempotency-key/);
  assert.doesNotMatch(source, /https?:\/\//);
});

test('billing operator app uses plain Danish workflow copy and never derives billable time from calendar duration', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Indbakke/);
  assert.match(source, /Klar til fakturering/);
  assert.match(source, /Venter/);
  assert.match(source, /Mangler oplysninger/);
  assert.match(source, /Faktureret/);
  assert.match(source, /Tilføj arbejdstid/);
  assert.match(source, /Gennemgå faktura/);
  assert.match(source, /Intl\.NumberFormat/);
  assert.match(source, /missing_actuals/);
  assert.doesNotMatch(source, /scheduledEnd[^\n]*-[^\n]*scheduledStart/);
  assert.doesNotMatch(source, /alarm|nøglekode|keycode|door code/i);
});

test('billing styling dogfoods Aftergraph tokens and remains usable on mobile safe areas', async () => {
  const css = await text('styles/billing.css');
  assert.match(css, /var\(--bg\)/);
  assert.match(css, /var\(--surface\)/);
  assert.match(css, /var\(--accent\)/);
  assert.match(css, /@media\s*\(max-width:\s*760px\)/);
  assert.match(css, /position:\s*sticky/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /@import\s+url\(/i);
});

test('billing app loads only first-party modules and token/reset/billing styles', async () => {
  const html = await text('billing/index.html');
  assert.match(html, /\/styles\/tokens\.css/);
  assert.match(html, /\/styles\/reset\.css/);
  assert.match(html, /\/styles\/billing\.css/);
  assert.match(html, /\/src\/billing\/billing-app\.mjs/);
  assert.match(html, /\/src\/billing\/pwa\.mjs/);
  assert.match(html, /manifest\.webmanifest/);
  assert.doesNotMatch(html, /<script(?![^>]*type="module")[^>]*src=/i);
});

test('Studio Work launches Billing as a product without adding a fourth primary mode', async () => {
  const work = await text('src/views/work-view.mjs');
  const shell = await text('src/workspace-shell.mjs');
  const index = await text('index.html');
  assert.match(work, /href="\/billing\/"/);
  assert.match(work, /Aftergraph Billing/);
  assert.match(index, /styles\/billing-launcher\.css/);
  assert.match(shell, /id:'chat'/);
  assert.match(shell, /id:'work'/);
  assert.match(shell, /id:'space'/);
  assert.doesNotMatch(shell, /id:'billing'/);
});
