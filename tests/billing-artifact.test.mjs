import test from 'node:test';
import assert from 'node:assert/strict';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import { createBillingDraft, issueBillingInvoice } from '../src/billing/mutations.mjs';
import { renderInvoicePdf } from '../src/billing/artifact.mjs';

function issuedFixtureInvoice() {
  let billing = billingFixtureState();
  let result = createBillingDraft(billing, {
    customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'],
    number: '1370', issueDate: '2026-09-11', actor: 'operator-1',
  });
  billing = result.billing;
  result = issueBillingInvoice(billing, { invoiceId: result.invoice.id, actor: 'operator-1' });
  return { billing: result.billing, invoice: result.invoice };
}

test('issued invoice renders as a deterministic downloadable PDF artifact', () => {
  const { billing, invoice } = issuedFixtureInvoice();
  const first = renderInvoicePdf({ billing, invoiceId: invoice.id });
  const second = renderInvoicePdf({ billing, invoiceId: invoice.id });

  assert.equal(first.contentType, 'application/pdf');
  assert.equal(first.filename, 'invoice-1370.pdf');
  assert.ok(Buffer.isBuffer(first.body));
  assert.equal(first.body.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.deepEqual(first.body, second.body);
  assert.ok(first.body.length > 700);
});

test('draft invoices cannot produce a finalized invoice artifact', () => {
  const billing = billingFixtureState();
  const result = createBillingDraft(billing, {
    customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'],
    number: '1370', issueDate: '2026-09-11', actor: 'operator-1',
  });
  assert.throws(() => renderInvoicePdf({ billing: result.billing, invoiceId: result.invoice.id }), /invoice_not_issued/);
});

test('invoice artifact is based on immutable issuer and customer snapshots', () => {
  const fixture = issuedFixtureInvoice();
  const billing = fixture.billing;
  const invoice = billing.invoices[0];
  invoice.issuerSnapshot = { name:'Seller ApS', address:'Seller Street 1', cvr:'12345678', paymentText:'Bank 1234' };
  invoice.customerSnapshot = { name:'Original Customer', address:'Buyer Street 2', email:'buyer@example.test' };
  invoice.serviceLabel = 'Rengøring';
  billing.settings.issuer = { name:'Changed Seller', address:'Other', cvr:'99999999' };
  billing.customers[0].name = 'Changed Customer';
  const text = renderInvoicePdf({ billing, invoiceId: invoice.id }).body.toString('latin1');
  assert.match(text, /Seller ApS/);
  assert.match(text, /CVR: 12345678/);
  assert.match(text, /Buyer Street 2/);
  assert.match(text, /Rengøring/);
  assert.doesNotMatch(text, /Changed Seller|Changed Customer/);
});

test('PDF artifact is a renderer of the canonical invoice document, not a second billing model', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/billing/artifact.mjs', import.meta.url), 'utf8'));
  assert.match(source, /buildInvoiceDocument/);
  assert.doesNotMatch(source, /billing\.customers\?\.find/);
});

test('PDF renderer paginates long invoices instead of drawing beyond the page', () => {
  const fixture = issuedFixtureInvoice();
  const invoice = fixture.billing.invoices[0];
  const baseLine = structuredClone(invoice.lines[0]);
  invoice.lines = [];
  for (let index = 0; index < 45; index += 1) {
    const visitId = `long-${index + 1}`;
    fixture.billing.visits.push({ id: visitId, scheduledStart: `2026-09-${String((index % 28) + 1).padStart(2, '0')}T08:00:00Z` });
    invoice.lines.push({ ...structuredClone(baseLine), visitId });
  }
  const pdf = renderInvoicePdf({ billing: fixture.billing, invoiceId: invoice.id }).body.toString('latin1');
  assert.match(pdf, /\/Type \/Pages \/Kids \[[^\]]+\] \/Count [2-9]/);
});
