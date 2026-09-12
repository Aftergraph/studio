import { createHash } from 'node:crypto';
import { BILLING_SOURCE_SCHEMA } from './source-contract.mjs';

function codedError(code, status = 422) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function clone(value) { return structuredClone(value); }

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
}

function digestPayload(customers, visits) {
  const payload = {
    customers: [...customers].sort((a, b) => String(a.id).localeCompare(String(b.id))),
    visits: [...visits].sort((a, b) => String(a.id).localeCompare(String(b.id))),
  };
  return createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}
function assertSource(source) {
  if (!source?.id || typeof source.id !== 'string') throw codedError('source_id_required');
  if (!source?.revision || typeof source.revision !== 'string') throw codedError('source_revision_required');
  if (!source?.syncedAt || Number.isNaN(Date.parse(source.syncedAt))) throw codedError('source_synced_at_required');
}

function assertCustomer(customer) {
  if (!customer?.id || !customer?.name) throw codedError('invalid_customer');
  if (!['active', 'inactive'].includes(customer.status)) throw codedError('invalid_customer_status');
  const billing = customer.billing;
  if (!billing || !['per_visit', 'monthly_batch'].includes(billing.mode)) throw codedError('invalid_customer_billing');
  if (!Number.isInteger(billing.rateMinor) || billing.rateMinor < 0) throw codedError('invalid_customer_billing');
  if (!billing.currency) throw codedError('invalid_customer_billing');
}
function assertVisit(visit) {
  if (!visit?.id || !visit?.customerId) throw codedError('invalid_visit');
  if (!['planned', 'completed', 'cancelled'].includes(visit.status)) throw codedError('invalid_visit_status');
  if (!visit.scheduledStart || !visit.scheduledEnd) throw codedError('invalid_visit_schedule');
  if (visit.actual !== undefined) {
    const minutes = visit.actual?.workMinutes;
    if (!Number.isInteger(minutes) || minutes < 0) throw codedError('invalid_actuals');
    const workers = visit.actual?.workers;
    if (workers !== undefined && (!Number.isInteger(workers) || workers < 1)) throw codedError('invalid_actuals');
  }
}

function sameJson(left, right) {
  return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}
function customerRecord(input, source) {
  const record = {
    id: input.id, name: input.name, address: input.address || null, email: input.email || null,
    status: input.status, billing: clone(input.billing),
    source: { id: source.id, revision: source.revision },
  };
  for (const key of ['countryCode', 'registrationId', 'registrationScheme', 'cvr', 'endpoint']) {
    if (input[key] !== undefined) record[key] = clone(input[key]);
  }
  return record;
}

function visitRecord(input, source, preservedActual = undefined) {
  const record = {
    id: input.id, customerId: input.customerId,
    scheduledStart: input.scheduledStart, scheduledEnd: input.scheduledEnd,
    status: input.status, source: { id: source.id, revision: source.revision },
  };
  const actual = preservedActual ?? input.actual;
  if (actual !== undefined) record.actual = clone(actual);
  return record;
}
function assertSourceOwnership(existing, sourceId) {
  if (!existing) return;
  if (existing.source?.id !== sourceId) throw codedError('source_record_conflict', 409);
}

export function syncBillingSource(billing, { schema, source, customers = [], visits = [] } = {}) {
  if (schema !== BILLING_SOURCE_SCHEMA) throw codedError('unsupported_source_schema');
  assertSource(source);
  if (!Array.isArray(customers) || !Array.isArray(visits)) throw codedError('invalid_source_payload');
  customers.forEach(assertCustomer);
  visits.forEach(assertVisit);

  const next = clone(billing);
  next.sourceSync ||= {};
  const digest = digestPayload(customers, visits);
  const previous = next.sourceSync[source.id];
  if (previous?.revision === source.revision) {
    if (previous.digest !== digest) throw codedError('source_revision_conflict', 409);
    return { billing: next, summary: { replayed: true, customersCreated: 0, customersUpdated: 0, visitsCreated: 0, visitsUpdated: 0 } };
  }

  const summary = { replayed: false, customersCreated: 0, customersUpdated: 0, visitsCreated: 0, visitsUpdated: 0 };
  const customerIds = new Set(next.customers.map((entry) => entry.id));
  for (const input of customers) {
    const index = next.customers.findIndex((entry) => entry.id === input.id);
    const existing = index >= 0 ? next.customers[index] : null;
    assertSourceOwnership(existing, source.id);
    const record = customerRecord(input, source);
    if (index >= 0) {
      next.customers[index] = record;
      summary.customersUpdated += 1;
    } else {
      next.customers.push(record);
      customerIds.add(record.id);
      summary.customersCreated += 1;
    }
  }
  for (const input of visits) {
    if (!customerIds.has(input.customerId)) throw codedError('customer_not_found', 422);
    const index = next.visits.findIndex((entry) => entry.id === input.id);
    const existing = index >= 0 ? next.visits[index] : null;
    assertSourceOwnership(existing, source.id);
    if (existing?.actual && input.actual && !sameJson(existing.actual, input.actual)) {
      throw codedError('actuals_conflict', 409);
    }
    const record = visitRecord(input, source, existing?.actual);
    if (index >= 0) {
      next.visits[index] = record;
      summary.visitsUpdated += 1;
    } else {
      next.visits.push(record);
      summary.visitsCreated += 1;
    }
  }
  next.sourceSync[source.id] = {
    revision: source.revision,
    digest,
    syncedAt: source.syncedAt,
  };
  return { billing: next, summary };
}
