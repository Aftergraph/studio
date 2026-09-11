import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const text = (path) => readFile(new URL(path, root), 'utf8');

test('production server wires Billing delivery from explicit environment configuration', async () => {
  const server = await text('server.mjs');
  assert.match(server, /billingDeliveryAdapterFromEnv/);
  assert.match(server, /billingDeliveryAdapter/);
});

test('Billing production docs describe current document, delivery and tenant boundaries', async () => {
  const app = await text('docs/billing/APP.md');
  const production = await text('docs/PRODUCTION.md');
  const extraction = await text('docs/billing/EXTRACTION.md');
  assert.match(app, /Virksomhedsprofil/);
  assert.match(app, /PDF/);
  assert.match(app, /Peppol|UBL/);
  assert.match(app, /delivery|levering/i);
  assert.match(production, /AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_URL/);
  assert.match(production, /AFTERGRAPH_BILLING_DELIVERY_WEBHOOK_TOKEN/);
  assert.match(extraction, /document-profile\.mjs/);
  assert.match(extraction, /peppol-bis3\.mjs/);
  assert.match(extraction, /billing-delivery\.mjs/);
});

test('public pilot release checklist exists and keeps merge separate from deployment', async () => {
  const release = await text('docs/billing/RELEASE.md');
  assert.match(release, /public pilot/i);
  assert.match(release, /delivery provider/i);
  assert.match(release, /tenant onboarding/i);
  assert.match(release, /exact-head/i);
  assert.match(release, /rollback/i);
});
