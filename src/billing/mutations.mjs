import { evaluateBilling } from './readiness.mjs';
import { projectInvoice } from './money.mjs';

function codedError(code, message = code, status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function clone(value) {
  return structuredClone(value);
}

function assertDateOnly(value, field) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw codedError(`invalid_${field}`, `${field} must use YYYY-MM-DD`);
  }
  return value;
}

function addDays(dateOnly, days) {
  const date = new Date(`${dateOnly}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw codedError('invalid_issueDate');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sameIds(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function recordBillingActual(billing, { visitId, actual } = {}) {
  const next = clone(billing);
  const visit = next.visits.find((entry) => entry.id === visitId);
  if (!visit) throw codedError('visit_not_found', 'visit not found', 404);
  if (visit.status !== 'completed') throw codedError('visit_not_completed');
  if (!actual || !Number.isInteger(actual.workMinutes) || actual.workMinutes < 0) {
    throw codedError('invalid_actuals', 'actual workMinutes must be a non-negative integer');
  }
  if (actual.workers !== undefined && (!Number.isInteger(actual.workers) || actual.workers < 1)) {
    throw codedError('invalid_actuals', 'actual workers must be a positive integer');
  }
  visit.actual = clone(actual);
  return { billing: next, visit: clone(visit) };
}

export function createBillingDraft(billing, {
  customerId,
  visitIds,
  number,
  issueDate,
  actor,
} = {}) {
  const next = clone(billing);
  if (!customerId) throw codedError('customer_required');
  if (!Array.isArray(visitIds) || visitIds.length === 0) throw codedError('visit_ids_required');
  assertDateOnly(issueDate, 'issueDate');
  const suppliedNumber = String(number || '').trim();
  const sequence = next.settings?.invoiceSequence;
  let resolvedNumber = suppliedNumber;
  if (!resolvedNumber) {
    if (!Number.isInteger(sequence?.nextNumber) || sequence.nextNumber < 1) throw codedError('invoice_number_sequence_required');
    resolvedNumber = String(sequence.nextNumber);
  }

  // Visit eligibility is the primary invariant. Check readiness before invoice
  // number reservation so an already-bound visit consistently fails closed as
  // billing_not_ready, while a genuinely unrelated number collision still
  // reports invoice_number_conflict below.
  const readiness = evaluateBilling({ ...next, now: `${issueDate}T23:59:59Z` });
  const ready = readiness.items.find((item) =>
    item.status === 'ready'
    && item.customerId === customerId
    && sameIds(item.visitIds, visitIds),
  );
  if (!ready) throw codedError('billing_not_ready');

  if (next.invoices.some((invoice) => invoice.status !== 'void' && String(invoice.number) === resolvedNumber)) {
    throw codedError('invoice_number_conflict', 'invoice number already reserved', 409);
  }

  const customer = next.customers.find((entry) => entry.id === customerId);
  if (!customer) throw codedError('customer_not_found', 'customer not found', 404);
  const visits = visitIds.map((id) => next.visits.find((visit) => visit.id === id));
  if (visits.some((visit) => !visit)) throw codedError('visit_not_found', 'visit not found', 404);

  const money = projectInvoice({
    customer,
    visits,
    taxRateBps: next.settings?.taxRateBps ?? 0,
  });
  const terms = Number.isInteger(customer.billing?.paymentTermsDays)
    ? customer.billing.paymentTermsDays
    : 0;
  const id = `invoice-${resolvedNumber}`;
  const invoice = {
    id,
    number: resolvedNumber,
    customerId,
    visitIds: [...visitIds],
    issueDate,
    dueDate: addDays(issueDate, terms),
    status: 'draft',
    createdBy: actor ?? null,
    issuerSnapshot: clone(next.settings?.issuer),
    customerSnapshot: {
      name: customer.name, address: customer.address, email: customer.email || null,
      countryCode: customer.countryCode || null,
      registrationId: customer.registrationId || customer.cvr || null,
      registrationScheme: customer.registrationScheme || null,
      endpoint: customer.endpoint ? clone(customer.endpoint) : null,
    },
    serviceLabel: String(next.settings?.defaultServiceLabel || 'Service'),
    ...money,
  };
  next.invoices.push(invoice);
  if (!suppliedNumber && sequence) sequence.nextNumber += 1;
  else if (sequence && /^\d+$/.test(resolvedNumber) && Number(resolvedNumber) >= sequence.nextNumber) sequence.nextNumber = Number(resolvedNumber) + 1;
  return { billing: next, invoice: clone(invoice) };
}

export function issueBillingInvoice(billing, { invoiceId, actor } = {}) {
  const next = clone(billing);
  const invoice = next.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 'invoice not found', 404);
  if (invoice.status === 'issued' || invoice.status === 'emailed') {
    return { billing: next, invoice: clone(invoice) };
  }
  if (invoice.status !== 'draft') throw codedError('invoice_not_issuable');
  invoice.status = 'issued';
  invoice.issuedBy = actor ?? null;
  invoice.issuedAt = new Date().toISOString();
  return { billing: next, invoice: clone(invoice) };
}

export function deliverBillingInvoice(billing, { invoiceId, actor, delivery } = {}) {
  const next = clone(billing);
  const invoice = next.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 'invoice not found', 404);
  if (invoice.status === 'emailed') return { billing: next, invoice: clone(invoice) };
  if (invoice.status !== 'issued') throw codedError('invoice_not_deliverable');
  if (!delivery?.provider || !delivery?.messageId || !delivery?.deliveredAt) {
    throw codedError('delivery_confirmation_required');
  }
  const deliveredAt = new Date(delivery.deliveredAt);
  if (Number.isNaN(deliveredAt.getTime())) throw codedError('invalid_delivery_confirmation');
  invoice.status = 'emailed';
  invoice.delivery = {
    provider: String(delivery.provider),
    messageId: String(delivery.messageId),
    deliveredAt: deliveredAt.toISOString(),
    deliveredBy: actor ?? null,
  };
  return { billing: next, invoice: clone(invoice) };
}


export function beginBillingDelivery(billing, { invoiceId, actor, provider, requestedAt } = {}) {
  const next = clone(billing);
  const invoice = next.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 'invoice not found', 404);
  if (invoice.status === 'emailed') return { billing: next, invoice: clone(invoice) };
  if (invoice.status !== 'issued') throw codedError('invoice_not_deliverable');
  if (!String(provider || '').trim()) throw codedError('delivery_provider_required');
  const at = new Date(requestedAt || new Date().toISOString());
  if (Number.isNaN(at.getTime())) throw codedError('invalid_delivery_request');
  invoice.delivery = {
    state: 'pending',
    provider: String(provider).trim(),
    requestedAt: at.toISOString(),
    requestedBy: actor ?? null,
  };
  return { billing: next, invoice: clone(invoice) };
}

export function failBillingDelivery(billing, { invoiceId, errorCode, failedAt } = {}) {
  const next = clone(billing);
  const invoice = next.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 'invoice not found', 404);
  if (invoice.status === 'emailed') return { billing: next, invoice: clone(invoice) };
  if (invoice.status !== 'issued' || invoice.delivery?.state !== 'pending') {
    throw codedError('delivery_not_pending');
  }
  const at = new Date(failedAt || new Date().toISOString());
  if (Number.isNaN(at.getTime())) throw codedError('invalid_delivery_failure');
  invoice.delivery = {
    ...invoice.delivery,
    state: 'failed',
    errorCode: String(errorCode || 'delivery_failed'),
    failedAt: at.toISOString(),
  };
  return { billing: next, invoice: clone(invoice) };
}

export function updateBillingSettings(billing, {
  issuer = undefined,
  defaultServiceLabel = undefined,
  invoiceSequence = undefined,
} = {}) {
  const next = clone(billing);
  next.settings ||= {};

  if (issuer !== undefined) {
    if (!issuer?.name || !issuer?.address || !issuer?.countryCode) throw codedError('issuer_profile_incomplete');
    const registrationId = issuer.registrationId || issuer.cvr;
    if (!registrationId) throw codedError('issuer_registration_required');
    if (issuer.endpoint && (!issuer.endpoint.schemeId || !issuer.endpoint.value)) throw codedError('issuer_endpoint_incomplete');
    next.settings.issuer = clone({ ...issuer, registrationId });
  }

  if (defaultServiceLabel !== undefined) {
    const label = String(defaultServiceLabel || '').trim();
    if (!label) throw codedError('default_service_label_required');
    next.settings.defaultServiceLabel = label;
  }

  if (invoiceSequence !== undefined) {
    const nextNumber = invoiceSequence?.nextNumber;
    if (!Number.isInteger(nextNumber) || nextNumber < 1) throw codedError('invalid_invoice_sequence');
    const maxReserved = (next.invoices || [])
      .filter((entry) => entry?.status !== 'void' && /^\d+$/.test(String(entry?.number || '')))
      .reduce((max, entry) => Math.max(max, Number(entry.number)), 0);
    if (nextNumber <= maxReserved) throw codedError('invoice_sequence_conflict', 'invoice sequence would reuse a reserved number', 409);
    next.settings.invoiceSequence = { nextNumber };
  }

  return { billing: next, settings: clone(next.settings) };
}
