import { randomUUID } from 'node:crypto';
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

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function assertActual(actual) {
  if (!actual || !Number.isInteger(actual.workMinutes) || actual.workMinutes < 0) {
    throw codedError('invalid_actuals', 'actual workMinutes must be a non-negative integer');
  }
  if (actual.workers !== undefined && (!Number.isInteger(actual.workers) || actual.workers < 1)) {
    throw codedError('invalid_actuals', 'actual workers must be a positive integer');
  }
}

function activeInvoiceForVisit(invoices, visitId) {
  return invoices.find((invoice) => invoice?.status !== 'void' && invoice?.visitIds?.includes(visitId));
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
  assertActual(actual);

  if (visit.actual !== undefined) {
    if (sameJson(visit.actual, actual)) {
      return { billing: next, visit: clone(visit), replayed: true };
    }
    throw codedError('actuals_conflict', 'actual evidence already recorded', 409);
  }

  const activeInvoice = activeInvoiceForVisit(next.invoices, visitId);
  if (activeInvoice) {
    throw codedError('actuals_locked', 'actual evidence is locked by an invoice', 409);
  }

  visit.actual = clone(actual);
  return { billing: next, visit: clone(visit), replayed: false };
}

export function correctBillingActual(billing, {
  visitId,
  actual,
  actor,
  reason,
  correctionId,
  correctedAt,
} = {}) {
  const next = clone(billing);
  const visit = next.visits.find((entry) => entry.id === visitId);
  if (!visit) throw codedError('visit_not_found', 'visit not found', 404);
  if (visit.status !== 'completed') throw codedError('visit_not_completed');
  if (!visit.actual) throw codedError('actuals_missing');
  if (!String(actor || '').trim()) throw codedError('correction_actor_required');
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw codedError('correction_reason_required');
  if (cleanReason.length > 1000) throw codedError('correction_reason_too_long');
  assertActual(actual);

  const existingAudit = (next.auditLog || []).find((event) =>
    event.type === 'billing.actuals.corrected' && event.id === correctionId);
  if (existingAudit) {
    return { billing: next, visit: clone(visit), audit: clone(existingAudit), replayed: true };
  }
  if (sameJson(visit.actual, actual)) throw codedError('actuals_unchanged');
  if (activeInvoiceForVisit(next.invoices, visitId)) {
    throw codedError('actuals_locked', 'actual evidence is locked by an invoice', 409);
  }

  const at = new Date(correctedAt || new Date().toISOString());
  if (Number.isNaN(at.getTime())) throw codedError('invalid_correction_time');
  const audit = {
    id: String(correctionId || `actual-correction-${randomUUID()}`),
    type: 'billing.actuals.corrected',
    visitId,
    actor: String(actor),
    reason: cleanReason,
    correctedAt: at.toISOString(),
    before: clone(visit.actual),
    after: clone(actual),
  };
  visit.actual = clone(actual);
  next.auditLog ||= [];
  next.auditLog.push(audit);
  return { billing: next, visit: clone(visit), audit: clone(audit), replayed: false };
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
    ...(delivery.attemptId || invoice.delivery?.attemptId
      ? { attemptId: String(delivery.attemptId || invoice.delivery.attemptId) }
      : {}),
    provider: String(delivery.provider),
    messageId: String(delivery.messageId),
    deliveredAt: deliveredAt.toISOString(),
    deliveredBy: actor ?? null,
  };
  return { billing: next, invoice: clone(invoice) };
}


export function beginBillingDelivery(billing, { invoiceId, actor, provider, attemptId, requestedAt } = {}) {
  const next = clone(billing);
  const invoice = next.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 'invoice not found', 404);
  if (invoice.status === 'emailed') return { billing: next, invoice: clone(invoice) };
  if (invoice.status !== 'issued') throw codedError('invoice_not_deliverable');
  if (invoice.delivery?.state === 'pending') {
    throw codedError('delivery_in_progress', 'delivery attempt already in progress', 409);
  }
  if (!String(provider || '').trim()) throw codedError('delivery_provider_required');
  const at = new Date(requestedAt || new Date().toISOString());
  if (Number.isNaN(at.getTime())) throw codedError('invalid_delivery_request');
  const resolvedAttemptId = String(attemptId || `delivery-${randomUUID()}`);
  if (!resolvedAttemptId.trim()) throw codedError('delivery_attempt_id_required');
  invoice.delivery = {
    state: 'pending',
    attemptId: resolvedAttemptId,
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

export function createBillingCustomer(billing, {
  id,
  name,
  address,
  email,
  countryCode,
  registrationId,
  registrationScheme,
  billing: billingInput,
  actor,
} = {}) {
  const next = clone(billing);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw codedError('customer_id_required');
  if (!/^[\w-]+$/.test(cleanId)) throw codedError('invalid_customer_id_format');
  const cleanName = String(name || '').trim();
  if (!cleanName) throw codedError('customer_name_required');
  if (next.customers.some((c) => c.id === cleanId)) {
    const err = codedError('customer_id_conflict');
    err.status = 409;
    throw err;
  }
  const mode = billingInput?.mode;
  if (!['per_visit', 'monthly_batch'].includes(mode)) throw codedError('invalid_billing_mode');
  const rateMinor = Number(billingInput?.rateMinor);
  if (!Number.isInteger(rateMinor) || rateMinor < 0) throw codedError('invalid_rate');
  const currency = String(billingInput?.currency || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw codedError('invalid_currency');
  const paymentTermsDays = Number(billingInput?.paymentTermsDays);
  if (!Number.isInteger(paymentTermsDays) || paymentTermsDays < 0) throw codedError('invalid_payment_terms');
  const discountPercent = billingInput?.discountPercent;
  if (discountPercent !== undefined
    && (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
    throw codedError('invalid_discount');
  }
  const customer = {
    id: cleanId,
    name: cleanName,
    address: String(address || '').trim() || null,
    email: String(email || '').trim() || null,
    status: 'active',
    billing: {
      mode,
      paymentTermsDays,
      rateMinor,
      currency,
      ...(discountPercent !== undefined ? { discountPercent } : {}),
    },
    countryCode: String(countryCode || '').trim().toUpperCase() || null,
    registrationId: String(registrationId || '').trim() || null,
    registrationScheme: String(registrationScheme || '').trim() || null,
    createdAt: new Date().toISOString(),
    createdBy: actor ?? null,
  };
  next.customers.push(customer);
  return { billing: next, customer: clone(customer) };
}

export function voidBillingInvoice(billing, { invoiceId, actor, reason } = {}) {
  const next = clone(billing);
  const invoice = next.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 'invoice not found', 404);
  if (invoice.status === 'void') return { billing: next, invoice: clone(invoice), replayed: true };
  const cleanReason = String(reason || '').trim();
  if (!cleanReason) throw codedError('void_reason_required');
  if (cleanReason.length > 1000) throw codedError('void_reason_too_long');
  invoice.status = 'void';
  invoice.voidedAt = new Date().toISOString();
  invoice.voidedBy = actor ?? null;
  invoice.voidReason = cleanReason;
  next.auditLog ||= [];
  next.auditLog.push({
    id: `void-${randomUUID()}`,
    type: 'billing.invoice.voided',
    invoiceId,
    actor: actor ?? null,
    reason: cleanReason,
    at: invoice.voidedAt,
  });
  return { billing: next, invoice: clone(invoice), replayed: false };
}

export function recordBillingPayment(billing, { invoiceId, amountMinor, method, reference, paidAt, actor } = {}) {
  const next = clone(billing);
  const invoice = next.invoices.find((entry) => entry.id === invoiceId);
  if (!invoice) throw codedError('invoice_not_found', 'invoice not found', 404);
  if (invoice.status === 'void') throw codedError('invoice_voided');
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) throw codedError('invalid_payment_amount');
  const existingPayments = invoice.payments || [];
  const totalPaid = existingPayments.reduce((sum, p) => sum + p.amountMinor, 0);
  const outstanding = invoice.totalGrossMinor - totalPaid;
  if (outstanding <= 0) throw codedError('invoice_fully_paid');
  if (amountMinor > outstanding) throw codedError('payment_exceeds_outstanding');
  const cleanMethod = String(method || '').trim();
  if (!cleanMethod) throw codedError('payment_method_required');
  const at = new Date(paidAt || new Date().toISOString());
  if (Number.isNaN(at.getTime())) throw codedError('invalid_payment_date');
  const payment = {
    id: `pay-${randomUUID()}`,
    amountMinor,
    method: cleanMethod,
    reference: String(reference || '').trim() || null,
    paidAt: at.toISOString(),
    recordedBy: actor ?? null,
  };
  invoice.payments = [...existingPayments, payment];
  const newTotalPaid = totalPaid + amountMinor;
  if (newTotalPaid >= invoice.totalGrossMinor) {
    invoice.paidAt = at.toISOString();
  }
  next.auditLog ||= [];
  next.auditLog.push({
    id: `payment-${randomUUID()}`,
    type: 'billing.payment.recorded',
    invoiceId,
    paymentId: payment.id,
    amountMinor,
    method: cleanMethod,
    actor: actor ?? null,
    at: payment.paidAt,
  });
  return { billing: next, invoice: clone(invoice), payment: clone(payment), replayed: false };
}

export function updateBillingCustomer(billing, {
  id,
  name,
  address,
  email,
  countryCode,
  registrationId,
  registrationScheme,
  billing: billingInput,
  actor,
} = {}) {
  const next = clone(billing);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw codedError('customer_id_required');
  const index = next.customers.findIndex((c) => c.id === cleanId);
  if (index === -1) throw codedError('customer_not_found', 'customer not found', 404);
  const existing = next.customers[index];
  const updated = clone(existing);
  if (name !== undefined) {
    const cleanName = String(name).trim();
    if (!cleanName) throw codedError('customer_name_required');
    updated.name = cleanName;
  }
  if (address !== undefined) updated.address = String(address).trim() || null;
  if (email !== undefined) updated.email = String(email).trim() || null;
  if (countryCode !== undefined) updated.countryCode = String(countryCode).trim().toUpperCase() || null;
  if (registrationId !== undefined) updated.registrationId = String(registrationId).trim() || null;
  if (registrationScheme !== undefined) updated.registrationScheme = String(registrationScheme).trim() || null;
  if (billingInput !== undefined) {
    if (billingInput.mode !== undefined) {
      if (!['per_visit', 'monthly_batch'].includes(billingInput.mode)) throw codedError('invalid_billing_mode');
      updated.billing.mode = billingInput.mode;
    }
    if (billingInput.rateMinor !== undefined) {
      const rateMinor = Number(billingInput.rateMinor);
      if (!Number.isInteger(rateMinor) || rateMinor < 0) throw codedError('invalid_rate');
      updated.billing.rateMinor = rateMinor;
    }
    if (billingInput.currency !== undefined) {
      const currency = String(billingInput.currency).trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) throw codedError('invalid_currency');
      updated.billing.currency = currency;
    }
    if (billingInput.paymentTermsDays !== undefined) {
      const days = Number(billingInput.paymentTermsDays);
      if (!Number.isInteger(days) || days < 0) throw codedError('invalid_payment_terms');
      updated.billing.paymentTermsDays = days;
    }
    if (billingInput.discountPercent !== undefined) {
      const disc = billingInput.discountPercent;
      if (disc !== null && (!Number.isFinite(disc) || disc < 0 || disc > 100)) throw codedError('invalid_discount');
      if (disc === null) delete updated.billing.discountPercent;
      else updated.billing.discountPercent = disc;
    }
  }
  updated.updatedAt = new Date().toISOString();
  updated.updatedBy = actor ?? null;
  next.customers[index] = updated;
  return { billing: next, customer: clone(updated) };
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
