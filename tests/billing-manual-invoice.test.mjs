import test from 'node:test';
import assert from 'node:assert/strict';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import { projectManualInvoice } from '../src/billing/money.mjs';
import { createManualBillingDraft, updateManualBillingDraft, issueBillingInvoice } from '../src/billing/mutations.mjs';

const baseLines = [
  { description: 'Rengøring', quantity: 2, unitPriceMinor: 10000 },
];

test('projectManualInvoice computes integer totals with tax back-calculation', () => {
  const result = projectManualInvoice({
    currency: 'DKK',
    taxRateBps: 2500,
    lines: [{ description: 'Service', quantity: 3, unitPriceMinor: 12345 }],
  });
  assert.equal(result.subtotalGrossMinor, 37035);
  assert.equal(result.discountMinor, 0);
  assert.equal(result.totalGrossMinor, 37035);
  // net = round(37035 * 10000 / 12500) = 29628
  assert.equal(result.totalNetMinor, 29628);
  assert.equal(result.taxMinor, 37035 - 29628);
});

test('projectManualInvoice applies per-line discount before aggregation', () => {
  const result = projectManualInvoice({
    currency: 'DKK',
    taxRateBps: 0,
    lines: [
      { description: 'A', quantity: 1, unitPriceMinor: 10000, discountPercent: 10 },
      { description: 'B', quantity: 2, unitPriceMinor: 5000, discountPercent: 0 },
    ],
  });
  assert.equal(result.lines[0].grossMinor, 10000);
  assert.equal(result.lines[0].discountMinor, 1000);
  assert.equal(result.lines[0].totalGrossMinor, 9000);
  assert.equal(result.subtotalGrossMinor, 20000);
  assert.equal(result.discountMinor, 1000);
  assert.equal(result.totalGrossMinor, 19000);
});

test('projectManualInvoice rejects non-integer and negative inputs', () => {
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: 'x', quantity: 1.5, unitPriceMinor: 100 }] }), /quantity must be a positive integer/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: 'x', quantity: 0, unitPriceMinor: 100 }] }), /quantity must be a positive integer/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: 'x', quantity: 1, unitPriceMinor: -1 }] }), /unitPriceMinor must be a non-negative integer/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: 'x', quantity: 1, unitPriceMinor: 100, discountPercent: NaN }] }), /discountPercent must be between 0 and 100/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: 'x', quantity: 1, unitPriceMinor: 100, discountPercent: -1 }] }), /discountPercent must be between 0 and 100/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: 'x', quantity: 1, unitPriceMinor: 100, discountPercent: 101 }] }), /discountPercent must be between 0 and 100/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', taxRateBps: -1, lines: baseLines }), /taxRateBps must be non-negative/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', taxRateBps: 1.5, lines: baseLines }), /taxRateBps must be an integer/);
  assert.throws(() => projectManualInvoice({ currency: 'dkk', lines: baseLines }), /currency is required/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [] }), /at least one manual line/);
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: '', quantity: 1, unitPriceMinor: 100 }] }), /description is required/);
});

test('projectManualInvoice guards against unsafe numeric coercion', () => {
  assert.throws(() => projectManualInvoice({ currency: 'DKK', lines: [{ description: 'x', quantity: Number.MAX_SAFE_INTEGER, unitPriceMinor: Number.MAX_SAFE_INTEGER }] }), RangeError);
});

test('createManualBillingDraft reserves number and snapshots parties', () => {
  const billing = billingFixtureState();
  const result = createManualBillingDraft(billing, {
    customerId: 'customer-katrine',
    lines: baseLines,
    issueDate: '2026-09-14',
    actor: 'operator-test',
  });
  assert.equal(result.invoice.number, '1370');
  assert.equal(result.invoice.status, 'draft');
  assert.equal(result.invoice.source, 'manual');
  assert.equal(result.invoice.createdBy, 'operator-test');
  assert.equal(result.invoice.customerSnapshot.name, 'Katrine Rindom Andersen');
  assert.equal(result.invoice.issuerSnapshot.cvr, billing.settings.issuer.cvr);
  assert.equal(result.billing.settings.invoiceSequence.nextNumber, 1371);
  assert.equal(result.invoice.manualLines.length, 1);
  assert.equal(result.invoice.totalGrossMinor, 20000);
});

test('createManualBillingDraft accepts explicit number without advancing sequence below it', () => {
  const billing = billingFixtureState();
  const result = createManualBillingDraft(billing, {
    customerId: 'customer-katrine',
    lines: baseLines,
    number: '2000',
    issueDate: '2026-09-14',
    actor: 'op',
  });
  assert.equal(result.invoice.number, '2000');
  assert.equal(result.billing.settings.invoiceSequence.nextNumber, 2001);
});

test('createManualBillingDraft rejects duplicate active invoice numbers', () => {
  const billing = billingFixtureState();
  const first = createManualBillingDraft(billing, {
    customerId: 'customer-katrine',
    lines: baseLines,
    number: '5000',
    issueDate: '2026-09-14',
    actor: 'op',
  });
  assert.throws(() => createManualBillingDraft(first.billing, {
    customerId: 'customer-katrine',
    lines: baseLines,
    number: '5000',
    issueDate: '2026-09-15',
    actor: 'op',
  }), /invoice number already reserved/);
});

test('updateManualBillingDraft recalculates money and preserves status', () => {
  const billing = billingFixtureState();
  const created = createManualBillingDraft(billing, {
    customerId: 'customer-katrine',
    lines: baseLines,
    issueDate: '2026-09-14',
    actor: 'op',
  });
  const updated = updateManualBillingDraft(created.billing, {
    invoiceId: created.invoice.id,
    lines: [{ description: 'Vinduespudsning', quantity: 1, unitPriceMinor: 7500 }],
    actor: 'op-2',
  });
  assert.equal(updated.invoice.status, 'draft');
  assert.equal(updated.invoice.totalGrossMinor, 7500);
  assert.equal(updated.invoice.manualLines[0].description, 'Vinduespudsning');
  assert.equal(updated.invoice.updatedBy, 'op-2');
  assert.ok(updated.invoice.updatedAt);
});

test('updateManualBillingDraft rejects edits to issued invoices', () => {
  const billing = billingFixtureState();
  const created = createManualBillingDraft(billing, {
    customerId: 'customer-katrine',
    lines: baseLines,
    issueDate: '2026-09-14',
    actor: 'op',
  });
  const issued = issueBillingInvoice(created.billing, { invoiceId: created.invoice.id, actor: 'op' });
  assert.throws(() => updateManualBillingDraft(issued.billing, {
    invoiceId: created.invoice.id,
    lines: baseLines,
    actor: 'op',
  }), /only draft invoices can be edited/);
});

test('updateManualBillingDraft rejects non-manual drafts', () => {
  const billing = billingFixtureState();
  // Fabricate a visit-based draft to ensure guard fires.
  const fake = structuredClone(billing);
  fake.invoices.push({
    id: 'invoice-visit-draft',
    number: '9000',
    customerId: 'customer-katrine',
    visitIds: ['katrine-2026-09-07'],
    manualLines: [],
    status: 'draft',
    source: 'visit',
    issueDate: '2026-09-14',
    dueDate: '2026-09-22',
  });
  assert.throws(() => updateManualBillingDraft(fake, {
    invoiceId: 'invoice-visit-draft',
    lines: baseLines,
    actor: 'op',
  }), /only manual drafts can be edited this way/);
});
