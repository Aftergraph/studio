import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('payment form renders on issued invoices with outstanding balance display', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /function paymentFormHtml/);
  assert.match(source, /billing-payment-form/);
  assert.match(source, /payment-amount/);
  assert.match(source, /payment-method/);
  assert.match(source, /payment-reference/);
  assert.match(source, /payment-date/);
  assert.match(source, /Registrér betaling/);
  assert.match(source, /Udestående:/);
  assert.match(source, /outstandingFor/);
});

test('payment form uses integer minor units via Math.round conversion', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Math\.round\(parsed \* 100\)/);
  assert.match(source, /Number\.isInteger\(amountMinor\)/);
  assert.match(source, /amountMinor <= 0/);
});

test('payment form includes Danish method options and accessible error target', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Bankoverførsel/);
  assert.match(source, /MobilePay/);
  assert.match(source, /Kontant/);
  assert.match(source, /aria-describedby="billing-payment-error"/);
  assert.match(source, /id="billing-payment-error"/);
  assert.match(source, /role="alert"/);
});

test('credit note form renders with reason field and irreversibility warning', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /function creditNoteFormHtml/);
  assert.match(source, /billing-credit-form/);
  assert.match(source, /credit-reason/);
  assert.match(source, /Årsag til kreditnota/);
  assert.match(source, /kan ikke fortrydes/);
  assert.match(source, /Opret kreditnota/);
  assert.match(source, /maxlength="1000"/);
  assert.match(source, /aria-describedby="billing-credit-error"/);
});

test('payment and credit forms only render on issued non-voided invoices', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /issued && !voided \? paymentFormHtml/);
  assert.match(source, /issued && !voided \? creditNoteFormHtml/);
  assert.match(source, /const voided = state\.activeInvoice\.status === 'void'/);
});

test('voided invoice displays credit note status and reason', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Kreditnota oprettet/);
  assert.match(source, /Annulleret .* Årsag:/);
  assert.match(source, /state\.activeInvoice\.voidReason/);
});

test('submit handlers wire payment and credit forms to browser client', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /async function submitPayment/);
  assert.match(source, /async function submitCreditNote/);
  assert.match(source, /client\.recordPayment\(invoiceId/);
  assert.match(source, /client\.voidInvoice\(invoiceId, reason\)/);
  assert.match(source, /billing-payment-form.*submitPayment/s);
  assert.match(source, /billing-credit-form.*submitCreditNote/s);
});

test('payment submission validates required fields and converts to minor units', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Udfyld alle påkrævede felter/);
  assert.match(source, /Beløb skal være et positivt tal/);
  assert.match(source, /Ugyldigt beløb/);
});

test('credit note submission validates reason length limit', async () => {
  const source = await text('src/billing/billing-app.mjs');
  assert.match(source, /Angiv en årsag til kreditnotaen/);
  assert.match(source, /Årsag må højest være 1000 tegn/);
});

test('browser client exposes recordPayment and voidInvoice methods', async () => {
  const source = await text('src/billing/browser-client.mjs');
  assert.match(source, /recordPayment\(invoiceId/);
  assert.match(source, /voidInvoice\(invoiceId, reason\)/);
  assert.match(source, /\/api\/v1\/billing\/invoices\/.*\/payment/);
  assert.match(source, /\/api\/v1\/billing\/invoices\/.*\/void/);
});
