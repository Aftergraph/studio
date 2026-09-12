import test from 'node:test';
import assert from 'node:assert/strict';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import { createBillingDraft } from '../src/billing/mutations.mjs';

test('draft reserves the next invoice number atomically when number is omitted', () => {
  const billing = billingFixtureState();
  billing.settings.invoiceSequence = { nextNumber: 1370 };
  const result = createBillingDraft(billing, {
    customerId: 'customer-katrine',
    visitIds: ['katrine-2026-09-07'],
    issueDate: '2026-09-11',
    actor: 'operator-1',
  });
  assert.equal(result.invoice.number, '1370');
  assert.equal(result.billing.settings.invoiceSequence.nextNumber, 1371);
});

test('draft snapshots issuer, customer and service label for immutable artifacts', () => {
  const billing = billingFixtureState();
  const result = createBillingDraft(billing, {
    customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'], issueDate: '2026-09-11', actor: 'operator-1',
  });
  assert.equal(result.invoice.issuerSnapshot.cvr, billing.settings.issuer.cvr);
  assert.equal(result.invoice.customerSnapshot.address, billing.customers[0].address);
  assert.equal(result.invoice.serviceLabel, billing.settings.defaultServiceLabel);
});

test('draft snapshots structured party identifiers used by document adapters', () => {
  const billing = billingFixtureState();
  const customer = billing.customers.find((entry) => entry.id === 'customer-katrine');
  customer.countryCode = 'DK';
  customer.registrationId = '12345678';
  customer.registrationScheme = '0184';
  customer.endpoint = { schemeId: '0184', value: '12345678' };
  const result = createBillingDraft(billing, {
    customerId: customer.id, visitIds: ['katrine-2026-09-07'], issueDate: '2026-09-11', actor: 'operator-1',
  });
  assert.equal(result.invoice.customerSnapshot.countryCode, 'DK');
  assert.equal(result.invoice.customerSnapshot.registrationScheme, '0184');
  assert.deepEqual(result.invoice.customerSnapshot.endpoint, { schemeId: '0184', value: '12345678' });
});
