import test from 'node:test';
import assert from 'node:assert/strict';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import { createBillingDraft, issueBillingInvoice } from '../src/billing/mutations.mjs';
import {
  buildInvoiceDocument,
  validateInvoiceDocument,
  DOCUMENT_PROFILES,
} from '../src/billing/document-profile.mjs';
import { renderPeppolBis3Ubl } from '../src/billing/peppol-bis3.mjs';

function issuedDocument() {
  let billing = billingFixtureState();
  let result = createBillingDraft(billing, {
    customerId: 'customer-katrine',
    visitIds: ['katrine-2026-09-07'],
    issueDate: '2026-09-11', actor: 'operator-1',
  });
  result = issueBillingInvoice(result.billing, { invoiceId: result.invoice.id, actor: 'operator-1' });
  return { billing: result.billing, invoice: result.invoice };
}
test('canonical invoice document is immutable, versioned and renderer-neutral', () => {
  const { billing, invoice } = issuedDocument();
  const doc = buildInvoiceDocument({ billing, invoiceId: invoice.id });
  assert.equal(doc.schema, 'aftergraph.invoice.semantic.v1');
  assert.equal(doc.number, '1370');
  assert.equal(doc.seller.name, 'Rendetalje');
  assert.equal(doc.buyer.name, 'Katrine Rindom Andersen');
  assert.equal(doc.currency, 'DKK');
  assert.equal(doc.lines[0].serviceLabel, 'Rengøring');
  assert.equal(doc.lines[0].deliveryDate, '2026-09-07');
  assert.equal(doc.totals.grossMinor, 453700);
  assert.equal(doc.tax.rateBps, 2500);
});

test('Peppol preflight fails closed when electronic endpoints or country codes are missing', () => {
  const { billing, invoice } = issuedDocument();
  const stored = billing.invoices.find((entry) => entry.id === invoice.id);
  stored.issuerSnapshot.endpoint = null;
  stored.customerSnapshot.endpoint = null;
  const doc = buildInvoiceDocument({ billing, invoiceId: invoice.id });
  const result = validateInvoiceDocument(doc, { profile: 'peppol-bis-3.0-2026-05' });
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('seller_endpoint_required'));
  assert.ok(result.errors.includes('buyer_endpoint_required'));
});
test('Peppol BIS 3 adapter renders current May 2026 UBL profile after preflight passes', () => {
  const { billing, invoice } = issuedDocument();
  const stored = billing.invoices.find((entry) => entry.id === invoice.id);
  stored.issuerSnapshot.countryCode = 'DK';
  stored.issuerSnapshot.endpoint = { schemeId: '0184', value: '45564096' };
  stored.customerSnapshot.countryCode = 'DK';
  stored.customerSnapshot.endpoint = { schemeId: '0184', value: '12345678' };
  const doc = buildInvoiceDocument({ billing, invoiceId: invoice.id });
  const preflight = validateInvoiceDocument(doc, { profile: 'peppol-bis-3.0-2026-05' });
  assert.equal(preflight.ok, true, preflight.errors.join(','));
  const xml = renderPeppolBis3Ubl(doc);
  assert.match(xml, /urn:fdc:peppol\.eu:2017:poacc:billing:3\.0/);
  assert.match(xml, /<cbc:ProfileID>urn:fdc:peppol\.eu:2017:poacc:billing:01:1\.0<\/cbc:ProfileID>/);
  assert.match(xml, /<cbc:InvoiceTypeCode>380<\/cbc:InvoiceTypeCode>/);
  assert.match(xml, /<cbc:EndpointID schemeID="0184">45564096<\/cbc:EndpointID>/);
  assert.match(xml, /<cbc:CompanyID schemeID="0184">45564096<\/cbc:CompanyID>/);
  assert.match(xml, /<cbc:DocumentCurrencyCode>DKK<\/cbc:DocumentCurrencyCode>/);
});

test('future Nemhandel BIS 4 PINT profile is declared but cannot be emitted before the specification is final', () => {
  assert.equal(DOCUMENT_PROFILES['nemhandel-bis-4-pint'].status, 'planned');
  assert.equal(DOCUMENT_PROFILES['nemhandel-bis-4-pint'].emittable, false);
});
