import { randomUUID } from 'node:crypto';
import { createManualBillingDraft } from './mutations.mjs';

function codedError(code, message = code, status = 422) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function clone(value) {
  return structuredClone(value);
}

function assertProductLine(line, index) {
  if (!line || typeof line !== 'object') throw codedError('invalid_product_line');
  const description = String(line.description || '').trim();
  if (!description) throw codedError('invalid_product_line_description');
  const quantity = Number(line.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) throw codedError('invalid_product_line_quantity');
  const unitPriceMinor = Number(line.unitPriceMinor);
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) throw codedError('invalid_product_line_price');
  const discountPercent = line.discountPercent ?? 0;
  if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
    throw codedError('invalid_product_line_discount');
  }
  return { description, quantity, unitPriceMinor, discountPercent };
}

function computeNextRunAt(schedule, fromIso) {
  const from = fromIso ? new Date(fromIso) : new Date();
  if (schedule.cron) {
    // Cron scheduling is handled by the scheduler tick; return null to signal
    // that nextRunAt should be computed externally or left for cron evaluation.
    return null;
  }
  if (schedule.interval) {
    const { value, unit } = schedule.interval;
    if (!Number.isInteger(value) || value <= 0) throw codedError('invalid_interval_value');
    const next = new Date(from);
    switch (unit) {
      case 'hour': next.setUTCHours(next.getUTCHours() + value); break;
      case 'day': next.setUTCDate(next.getUTCDate() + value); break;
      case 'week': next.setUTCDate(next.getUTCDate() + (value * 7)); break;
      case 'month': next.setUTCMonth(next.getUTCMonth() + value); break;
      default: throw codedError('invalid_interval_unit');
    }
    return next.toISOString();
  }
  throw codedError('invalid_schedule');
}

export function createRecurringInvoice(billing, {
  customerId,
  productLines,
  schedule,
  actor,
} = {}) {
  const next = clone(billing);
  if (!customerId) throw codedError('customer_required');
  const customer = next.customers?.find((c) => c.id === customerId);
  if (!customer) throw codedError('customer_not_found', 'customer not found', 404);
  if (!Array.isArray(productLines) || productLines.length === 0) throw codedError('product_lines_required');
  const lines = productLines.map(assertProductLine);
  if (!schedule || (!schedule.cron && !schedule.interval)) throw codedError('schedule_required');

  next.recurringInvoices ||= [];
  const id = `recurring-${randomUUID()}`;
  const now = new Date().toISOString();
  const recurring = {
    id,
    customerId,
    productLines: lines,
    schedule: clone(schedule),
    nextRunAt: computeNextRunAt(schedule, now),
    active: true,
    lastInvoiceId: null,
    createdAt: now,
    createdBy: actor ?? null,
    updatedAt: now,
    updatedBy: actor ?? null,
  };
  next.recurringInvoices.push(recurring);
  return { billing: next, recurring: clone(recurring) };
}

export function updateRecurringInvoice(billing, {
  id,
  productLines,
  schedule,
  active,
  actor,
} = {}) {
  const next = clone(billing);
  next.recurringInvoices ||= [];
  const index = next.recurringInvoices.findIndex((r) => r.id === id);
  if (index === -1) throw codedError('recurring_not_found', 'recurring invoice not found', 404);
  const existing = next.recurringInvoices[index];
  const updated = clone(existing);

  if (productLines !== undefined) {
    if (!Array.isArray(productLines) || productLines.length === 0) throw codedError('product_lines_required');
    updated.productLines = productLines.map(assertProductLine);
  }
  if (schedule !== undefined) {
    if (!schedule || (!schedule.cron && !schedule.interval)) throw codedError('schedule_required');
    updated.schedule = clone(schedule);
    if (updated.active) {
      updated.nextRunAt = computeNextRunAt(schedule, new Date().toISOString());
    }
  }
  if (active !== undefined) {
    updated.active = Boolean(active);
    if (updated.active && !updated.nextRunAt) {
      updated.nextRunAt = computeNextRunAt(updated.schedule, new Date().toISOString());
    }
  }
  updated.updatedAt = new Date().toISOString();
  updated.updatedBy = actor ?? null;
  next.recurringInvoices[index] = updated;
  return { billing: next, recurring: clone(updated) };
}

export function deleteRecurringInvoice(billing, { id, actor } = {}) {
  const next = clone(billing);
  next.recurringInvoices ||= [];
  const index = next.recurringInvoices.findIndex((r) => r.id === id);
  if (index === -1) throw codedError('recurring_not_found', 'recurring invoice not found', 404);
  next.recurringInvoices.splice(index, 1);
  return { billing: next };
}

export function tickRecurringScheduler(billing, { now, actor } = {}) {
  const next = clone(billing);
  next.recurringInvoices ||= [];
  const currentTime = now ? new Date(now) : new Date();
  const generated = [];

  for (const recurring of next.recurringInvoices) {
    if (!recurring.active) continue;
    if (!recurring.nextRunAt) continue;
    const runAt = new Date(recurring.nextRunAt);
    if (runAt > currentTime) continue;

    // Generate draft invoice
    const issueDate = currentTime.toISOString().slice(0, 10);
    try {
      const result = createManualBillingDraft(next, {
        customerId: recurring.customerId,
        lines: recurring.productLines,
        issueDate,
        actor: actor ?? 'scheduler',
      });
      // Merge billing changes but preserve our recurringInvoices reference
      const updatedInvoices = result.billing.invoices;
      const updatedSequence = result.billing.settings?.invoiceSequence;
      if (updatedInvoices) next.invoices = updatedInvoices;
      if (updatedSequence) next.settings.invoiceSequence = updatedSequence;
      recurring.lastInvoiceId = result.invoice.id;
      recurring.nextRunAt = computeNextRunAt(recurring.schedule, currentTime.toISOString());
      recurring.updatedAt = currentTime.toISOString();
      recurring.updatedBy = actor ?? 'scheduler';
      generated.push({ recurringId: recurring.id, invoiceId: result.invoice.id });
    } catch (err) {
      // Log but don't fail other recurring invoices
      console.error(`[scheduler] Failed to generate invoice for ${recurring.id}:`, err.message);
    }
  }

  return { billing: next, generated };
}
