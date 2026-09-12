import test from 'node:test';
import assert from 'node:assert/strict';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import { updateBillingSettings } from '../src/billing/mutations.mjs';

function genericIssuer() {
  return {
    name: 'Example GmbH', address: 'Example Strasse 1, Berlin', countryCode: 'DE',
    registrationId: 'DE123456789', registrationSchemeId: '9930',
    email: 'billing@example.test', paymentText: 'Bank transfer',
  };
}

test('company settings are tenant data and accept non-Danish registration identities', () => {
  const billing = billingFixtureState();
  const result = updateBillingSettings(billing, {
    issuer: genericIssuer(), defaultServiceLabel: 'Consulting', invoiceSequence: { nextNumber: 2000 },
  });
  assert.equal(result.billing.settings.issuer.countryCode, 'DE');
  assert.equal(result.billing.settings.issuer.registrationId, 'DE123456789');
  assert.equal(result.billing.settings.defaultServiceLabel, 'Consulting');
  assert.equal(result.billing.settings.invoiceSequence.nextNumber, 2000);
});

test('invoice sequence cannot be rewound behind an already reserved numeric invoice', () => {
  const billing = billingFixtureState();
  billing.invoices.push({ id: 'invoice-1500', number: '1500', status: 'issued', customerId: 'x', visitIds: [] });
  assert.throws(() => updateBillingSettings(billing, {
    issuer: genericIssuer(), invoiceSequence: { nextNumber: 1500 },
  }), (error) => error?.code === 'invoice_sequence_conflict');
});

test('company settings fail closed on incomplete issuer identity', () => {
  const billing = billingFixtureState();
  assert.throws(() => updateBillingSettings(billing, {
    issuer: { name: 'No Registration Ltd', address: 'Somewhere 1', countryCode: 'GB' },
  }), /issuer_registration_required/);
});
