import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('customer management entry exists in billing header', async () => {
  const html = await text('billing/index.html');
  assert.match(html, /data-action="manage-customers"/);
  assert.match(html, />Kunder</);
});

test('customer create/edit forms expose labeled fields and validation', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /id="billing-customer-form"/);
  assert.match(source, /id="customer-name"/);
  assert.match(source, /id="customer-email"/);
  assert.match(source, /id="customer-address"/);
  assert.match(source, /id="customer-country"/);
  assert.match(source, /id="customer-registration"/);
  assert.match(source, /id="customer-currency"/);
  assert.match(source, /id="customer-tax"/);
  assert.match(source, /label for="customer-name"/);
  assert.match(source, /label for="customer-email"/);
  assert.match(source, /aria-describedby="billing-customer-error"/);
  assert.match(source, /id="billing-customer-error"/);
  assert.match(source, /role="alert"/);
});

test('customer form validates required fields and format constraints', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Udfyld navn, e-mail, adresse og landekode/);
  assert.match(source, /Landekode skal være to bogstaver/);
  assert.match(source, /Valuta skal være tre bogstaver/);
  assert.match(source, /\^\[A-Z\]\{2\}\$/);
  assert.match(source, /\^\[A-Z\]\{3\}\$/);
});

test('customer save dispatches createCustomer or updateCustomer based on mode', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /client\.createCustomer/);
  assert.match(source, /client\.updateCustomer/);
  assert.match(source, /mode === 'edit'/);
  // create path is the else branch when mode !== 'edit'
});

test('customer form handles pending/error/success states', async () => {
  const source = await text('src/billing/billing-app.mjs');
  // Pending: disables form controls during save
  assert.match(source, /form\.querySelectorAll\('button,input,select,textarea'\).*disabled = true/s);
  // Error: shows form error and re-enables
  assert.match(source, /showFormError\(form, message\)/);
  assert.match(source, /disabled = false/);
  // Success: toast confirmation
  assert.match(source, /Kunden er oprettet/);
  assert.match(source, /Kunden er opdateret/);
});

test('customer manager lists existing customers with edit action', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /data-action="edit-customer"/);
  assert.match(source, /data-customer-id=/);
  assert.match(source, /Redigér/);
  assert.match(source, /billing-customer-list/);
  assert.match(source, /Ingen kunder registreret endnu/);
});

test('customer create button opens form via data-action', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /data-action="create-customer"/);
  assert.match(source, /openCreateCustomer/);
  assert.match(source, /openEditCustomer/);
});

test('customer form submit handler is registered', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /billing-customer-form/);
  assert.match(source, /saveCustomer\(event\.target\)/);
});

test('customer operations respect canMutate guard', async () => {
  const source = await text('src/billing/billing-app.mjs');
  // openCustomerManager, openCreateCustomer, openEditCustomer all check canMutate
  const matches = source.match(/if \(state\.busy \|\| !canMutate\(\)\) return toast/g);
  assert.ok(matches && matches.length >= 3, 'customer open functions must guard with canMutate');
});

test('customer form preserves existing billing settings in edit mode', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /c\.billing\?\.currency/);
  assert.match(source, /c\.billing\?\.taxRateBps/);
  assert.match(source, /taxRateBps/);
});
