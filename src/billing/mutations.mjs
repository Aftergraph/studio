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
  if (!String(number || '').trim()) throw codedError('invoice_number_required');
  assertDateOnly(issueDate, 'issueDate');

  if (next.invoices.some((invoice) => invoice.status !== 'void' && String(invoice.number) === String(number))) {
    throw codedError('invoice_number_conflict', 'invoice number already reserved', 409);
  }

  const readiness = evaluateBilling({ ...next, now: `${issueDate}T23:59:59Z` });
  const ready = readiness.items.find((item) =>
    item.status === 'ready'
    && item.customerId === customerId
    && sameIds(item.visitIds, visitIds),
  );
  if (!ready) throw codedError('billing_not_ready');

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
  const id = `invoice-${String(number).trim()}`;
  const invoice = {
    id,
    number: String(number).trim(),
    customerId,
    visitIds: [...visitIds],
    issueDate,
    dueDate: addDays(issueDate, terms),
    status: 'draft',
    createdBy: actor ?? null,
    ...money,
  };
  next.invoices.push(invoice);
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
