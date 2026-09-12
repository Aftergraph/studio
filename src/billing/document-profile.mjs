export const DOCUMENT_PROFILES = Object.freeze({
  'aftergraph-semantic-v1': Object.freeze({
    status: 'active', emittable: true,
    schema: 'aftergraph.invoice.semantic.v1',
  }),
  'peppol-bis-3.0-2026-05': Object.freeze({
    status: 'active', emittable: true,
    family: 'Peppol BIS Billing 3.0', release: '2026-05',
    externalValidationRequired: true,
  }),
  'nemhandel-bis-4-pint': Object.freeze({
    status: 'planned', emittable: false,
    family: 'Nemhandel BIS 4 / Peppol BIS 4 PINT',
  }),
});

function codedError(code, status = 422) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function deliveryDate(billing, visitId) {
  const visit = billing.visits?.find((entry) => entry.id === visitId);
  return visit?.scheduledStart ? String(visit.scheduledStart).slice(0, 10) : null;
}
function party(snapshot = {}, { registrationScheme = null } = {}) {
  const registrationId = snapshot.cvr || snapshot.registrationId || null;
  return {
    name: snapshot.name || null,
    postalAddress: snapshot.address || null,
    countryCode: snapshot.countryCode || null,
    email: snapshot.email || null,
    phone: snapshot.phone || null,
    registrationId,
    registrationScheme: snapshot.registrationScheme || (registrationId ? registrationScheme : null),
    endpoint: snapshot.endpoint ? {
      schemeId: snapshot.endpoint.schemeId || null,
      value: snapshot.endpoint.value || null,
    } : null,
  };
}

export function buildInvoiceDocument({ billing, invoiceId } = {}) {
  const invoice = billing?.invoices?.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 404);
  if (!['issued', 'emailed'].includes(invoice.status)) throw codedError('invoice_not_issued');
  const seller = party(invoice.issuerSnapshot, { registrationScheme: invoice.issuerSnapshot?.countryCode === 'DK' ? '0184' : null });
  const buyer = party(invoice.customerSnapshot, { registrationScheme: invoice.customerSnapshot?.countryCode === 'DK' ? '0184' : null });
  const rateBps = Number(invoice.taxRateBps || 0);
  const lines = (invoice.lines || []).map((line, index) => ({
    id: String(index + 1), visitId: line.visitId,
    serviceLabel: invoice.serviceLabel || 'Service',
    deliveryDate: deliveryDate(billing, line.visitId),
    workMinutes: line.workMinutes,
    quantityHours: line.workMinutes / 60,
    grossUnitPriceMinor: line.rateMinor,
    discountPercent: line.discountPercent || 0,
    discountMinor: line.discountMinor || 0,
    grossMinor: line.totalGrossMinor,
    netMinor: Math.round((line.totalGrossMinor * 10000) / (10000 + rateBps)),
  }));
  return Object.freeze({
    schema: 'aftergraph.invoice.semantic.v1',
    profileVersion: 1,
    number: String(invoice.number),
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    currency: invoice.currency,
    status: invoice.status,
    seller,
    buyer,
    lines,
    tax: Object.freeze({
      categoryCode: 'S',
      rateBps,
      taxableMinor: invoice.totalNetMinor,
      taxMinor: invoice.taxMinor,
    }),
    totals: Object.freeze({
      netMinor: invoice.totalNetMinor,
      taxMinor: invoice.taxMinor,
      grossMinor: invoice.totalGrossMinor,
      payableMinor: invoice.totalGrossMinor,
    }),
    payment: Object.freeze({ text: invoice.issuerSnapshot?.paymentText || null }),
    source: Object.freeze({ invoiceId: invoice.id, visitIds: [...(invoice.visitIds || [])] }),
  });
}

function pushMissing(errors, condition, code) {
  if (!condition) errors.push(code);
}

export function validateInvoiceDocument(document, { profile = 'aftergraph-semantic-v1' } = {}) {
  const descriptor = DOCUMENT_PROFILES[profile];
  if (!descriptor) return { ok: false, profile, errors: ['unknown_document_profile'] };
  if (!descriptor.emittable) return { ok: false, profile, errors: ['document_profile_not_emittable'] };
  const errors = [];
  pushMissing(errors, document?.number, 'invoice_number_required');
  pushMissing(errors, document?.issueDate, 'invoice_issue_date_required');
  pushMissing(errors, document?.currency, 'invoice_currency_required');
  pushMissing(errors, document?.seller?.name, 'seller_name_required');
  pushMissing(errors, document?.buyer?.name, 'buyer_name_required');
  if (profile === 'peppol-bis-3.0-2026-05') {
    pushMissing(errors, document?.seller?.postalAddress, 'seller_address_required');
    pushMissing(errors, document?.seller?.countryCode, 'seller_country_required');
    pushMissing(errors, document?.buyer?.postalAddress, 'buyer_address_required');
    pushMissing(errors, document?.buyer?.countryCode, 'buyer_country_required');
    pushMissing(errors, document?.seller?.endpoint?.schemeId && document?.seller?.endpoint?.value, 'seller_endpoint_required');
    pushMissing(errors, document?.buyer?.endpoint?.schemeId && document?.buyer?.endpoint?.value, 'buyer_endpoint_required');
    pushMissing(errors, document?.seller?.registrationId, 'seller_registration_required');
  }
  return Object.freeze({
    ok: errors.length === 0,
    profile,
    descriptor,
    errors: Object.freeze(errors),
  });
}
