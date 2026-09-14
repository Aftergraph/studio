import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('manual invoice form exposes customer selector and line entry fields', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /id="billing-manual-form"/);
  assert.match(source, /id="billing-manual-customer"/);
  assert.match(source, /data-line-index=/);
  assert.match(source, /name="description"/);
  assert.match(source, /name="quantity"/);
  assert.match(source, /name="unitPrice"/);
  assert.match(source, /name="discountPercent"/);
});

test('manual invoice form has add-line and remove-line actions', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /data-action="add-manual-line"/);
  assert.match(source, /data-action="remove-manual-line"/);
  assert.match(source, /Tilføj linje/);
});

test('manual invoice form displays live VAT totals', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /id="billing-manual-subtotal"/);
  assert.match(source, /id="billing-manual-tax"/);
  assert.match(source, /id="billing-manual-total"/);
  assert.match(source, /Ekskl\. moms/);
  assert.match(source, /Moms/);
  assert.match(source, /I alt/);
});

test('manual invoice form validates required fields before submission', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Vælg en kunde/);
  assert.match(source, /Tilføj mindst én fakturalinje/);
  assert.match(source, /Beskrivelse er påkrævet/);
  assert.match(source, /Antal skal være et positivt heltal/);
  assert.match(source, /Enhedspris skal være et ikke-negativt tal/);
});

test('manual invoice create dispatches createManualDraft with integer minor units', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /client\.createManualDraft/);
  assert.match(source, /unitPriceMinor/);
  assert.match(source, /Math\.round.*\*\s*100/);
});

test('manual invoice edit mode opens for draft invoices with source manual', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /data-action="edit-manual-draft"/);
  assert.match(source, /client\.updateDraft/);
  assert.match(source, /Redigér kladde/);
});

test('manual invoice form preserves visit-based review flow unchanged', async () => {
  const source = await text('src/billing/billing-app.mjs');
  // Visit-based draft creation still exists
  assert.match(source, /id="billing-draft-form"/);
  assert.match(source, /client\.createDraft/);
  assert.match(source, /Gennemgå faktura/);
});

test('new invoice button opens manual line entry form instead of customer picker only', async () => {
  const source = await text('src/billing/billing-app.mjs');
  // openNewInvoice now renders the manual form
  assert.match(source, /openNewInvoice[\s\S]*?billing-manual-form/s);
});

test('manual invoice form handles pending/error/success states', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Fakturakladde.*oprettet/);
  assert.match(source, /Kunne ikke oprette fakturakladde/);
  assert.match(source, /billing-manual-error/);
});

test('manual invoice form respects canMutate guard', async () => {
  const source = await text('src/billing/billing-app.mjs');
  const matches = source.match(/if \(state\.busy \|\| !canMutate\(\)\) return toast/g);
  assert.ok(matches && matches.length >= 4, 'manual invoice open functions must guard with canMutate');
});
