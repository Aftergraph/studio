import { validateInvoiceDocument } from './document-profile.mjs';

const CUSTOMIZATION_ID = 'urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0';
const PROFILE_ID = 'urn:fdc:peppol.eu:2017:poacc:billing:01:1.0';

function xml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function amount(minor) {
  return (Number(minor || 0) / 100).toFixed(2);
}

function percent(rateBps) {
  return (Number(rateBps || 0) / 100).toFixed(2).replace(/\.00$/, '');
}

function unitNetMinor(line, taxRateBps) {
  return Math.round((line.grossUnitPriceMinor * 10000) / (10000 + taxRateBps));
}

function partyXml(tag, party, { legal = false } = {}) {
  const registration = legal && party.registrationId
    ? `<cac:PartyLegalEntity><cbc:RegistrationName>${xml(party.name)}</cbc:RegistrationName><cbc:CompanyID${party.registrationScheme ? ` schemeID="${xml(party.registrationScheme)}"` : ''}>${xml(party.registrationId)}</cbc:CompanyID></cac:PartyLegalEntity>`
    : '';
  return `<cac:${tag}><cac:Party><cbc:EndpointID schemeID="${xml(party.endpoint.schemeId)}">${xml(party.endpoint.value)}</cbc:EndpointID><cac:PartyName><cbc:Name>${xml(party.name)}</cbc:Name></cac:PartyName><cac:PostalAddress><cac:AddressLine><cbc:Line>${xml(party.postalAddress)}</cbc:Line></cac:AddressLine><cac:Country><cbc:IdentificationCode>${xml(party.countryCode)}</cbc:IdentificationCode></cac:Country></cac:PostalAddress>${registration}</cac:Party></cac:${tag}>`;
}
function lineXml(line, document) {
  const currency = xml(document.currency);
  const unitPrice = amount(unitNetMinor(line, document.tax.rateBps));
  const allowance = line.discountMinor
    ? `<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:MultiplierFactorNumeric>${xml(line.discountPercent / 100)}</cbc:MultiplierFactorNumeric><cbc:Amount currencyID="${currency}">${amount(Math.round((line.discountMinor * 10000) / (10000 + document.tax.rateBps)))}</cbc:Amount></cac:AllowanceCharge>`
    : '';
  return `<cac:InvoiceLine><cbc:ID>${xml(line.id)}</cbc:ID><cbc:InvoicedQuantity unitCode="HUR">${xml(line.quantityHours)}</cbc:InvoicedQuantity><cbc:LineExtensionAmount currencyID="${currency}">${amount(line.netMinor)}</cbc:LineExtensionAmount><cac:InvoicePeriod><cbc:StartDate>${xml(line.deliveryDate)}</cbc:StartDate><cbc:EndDate>${xml(line.deliveryDate)}</cbc:EndDate></cac:InvoicePeriod>${allowance}<cac:Item><cbc:Name>${xml(line.serviceLabel)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${percent(document.tax.rateBps)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item><cac:Price><cbc:PriceAmount currencyID="${currency}">${unitPrice}</cbc:PriceAmount><cbc:BaseQuantity unitCode="HUR">1</cbc:BaseQuantity></cac:Price></cac:InvoiceLine>`;
}

export function renderPeppolBis3Ubl(document) {
  const preflight = validateInvoiceDocument(document, { profile: 'peppol-bis-3.0-2026-05' });
  if (!preflight.ok) {
    const error = new Error(`peppol_preflight_failed:${preflight.errors.join(',')}`);
    error.code = 'peppol_preflight_failed';
    error.errors = preflight.errors;
    throw error;
  }
  const currency = xml(document.currency);
  const lines = document.lines.map((line) => lineXml(line, document)).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cbc:CustomizationID>${CUSTOMIZATION_ID}</cbc:CustomizationID><cbc:ProfileID>${PROFILE_ID}</cbc:ProfileID><cbc:ID>${xml(document.number)}</cbc:ID><cbc:IssueDate>${xml(document.issueDate)}</cbc:IssueDate><cbc:DueDate>${xml(document.dueDate)}</cbc:DueDate><cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode><cbc:DocumentCurrencyCode>${currency}</cbc:DocumentCurrencyCode>${partyXml('AccountingSupplierParty', document.seller, { legal: true })}${partyXml('AccountingCustomerParty', document.buyer)}<cac:TaxTotal><cbc:TaxAmount currencyID="${currency}">${amount(document.tax.taxMinor)}</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="${currency}">${amount(document.tax.taxableMinor)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${currency}">${amount(document.tax.taxMinor)}</cbc:TaxAmount><cac:TaxCategory><cbc:ID>S</cbc:ID><cbc:Percent>${percent(document.tax.rateBps)}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal><cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="${currency}">${amount(document.totals.netMinor)}</cbc:LineExtensionAmount><cbc:TaxExclusiveAmount currencyID="${currency}">${amount(document.totals.netMinor)}</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="${currency}">${amount(document.totals.grossMinor)}</cbc:TaxInclusiveAmount><cbc:PayableAmount currencyID="${currency}">${amount(document.totals.payableMinor)}</cbc:PayableAmount></cac:LegalMonetaryTotal>${lines}</Invoice>`;
}

export const PEPPOL_BIS3_PROFILE = Object.freeze({
  id: 'peppol-bis-3.0-2026-05',
  customizationId: CUSTOMIZATION_ID,
  profileId: PROFILE_ID,
  externalSchematronValidationRequired: true,
});
