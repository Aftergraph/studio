function monthKey(value) {
  if (typeof value !== 'string' || value.length < 7) return null;
  return value.slice(0, 7);
}

function sortByScheduledStart(a, b) {
  return String(a.scheduledStart ?? '').localeCompare(String(b.scheduledStart ?? ''));
}

function activeInvoiceBindings(invoices = []) {
  const byVisit = new Map();
  for (const invoice of invoices) {
    if (!invoice || invoice.status === 'void') continue;
    for (const visitId of invoice.visitIds ?? []) {
      if (!byVisit.has(visitId)) byVisit.set(visitId, invoice);
    }
  }
  return byVisit;
}

function missingCustomerField(customer) {
  if (!customer?.address) return 'missing_customer_address';
  if (!customer?.email) return 'missing_customer_email';
  if (!Number.isInteger(customer?.billing?.rateMinor) || customer.billing.rateMinor < 0) return 'missing_rate';
  if (!customer?.billing?.currency) return 'missing_currency';
  if (!['per_visit', 'monthly_batch'].includes(customer?.billing?.mode)) return 'unknown_billing_mode';
  return null;
}

function missingVisitEvidence(visits) {
  return visits.find((visit) => {
    const minutes = visit?.actual?.workMinutes;
    return !visit?.actual || !Number.isInteger(minutes) || minutes < 0;
  });
}

function itemBase(customer, visits) {
  return {
    customerId: customer.id,
    customerName: customer.name,
    visitIds: visits.map((visit) => visit.id),
  };
}

/**
 * Deterministically classify invoice readiness from canonical customer, visit
 * and invoice state. Calendar duration is never treated as billing evidence.
 */
export function evaluateBilling(input = {}) {
  const { customers = [], visits = [], invoices = [], settings = {}, now = null } = input;
  void now;
  const enforceIssuer = Object.prototype.hasOwnProperty.call(input, 'settings');
  const issuer = settings?.issuer;
  const issuerMissing = enforceIssuer && (!issuer?.name || !issuer?.address || !(issuer?.registrationId || issuer?.cvr));
  const items = [];
  const invoiceByVisit = activeInvoiceBindings(invoices);
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  // First project already-invoiced work so it can never re-enter another queue.
  for (const invoice of invoices) {
    if (!invoice || invoice.status === 'void') continue;
    const invoiceVisits = (invoice.visitIds ?? [])
      .map((visitId) => visits.find((visit) => visit.id === visitId))
      .filter(Boolean)
      .sort(sortByScheduledStart);
    const customer = customersById.get(invoice.customerId) ?? { id: invoice.customerId, name: invoice.customerId };
    items.push({
      ...itemBase(customer, invoiceVisits),
      status: 'invoiced',
      reasonCode: 'already_invoiced',
      invoiceId: invoice.id,
      invoiceNumber: invoice.number ?? null,
    });
  }

  for (const customer of customers) {
    if (!customer || customer.status !== 'active') continue;

    const customerVisits = visits
      .filter((visit) => visit?.customerId === customer.id)
      .sort(sortByScheduledStart);

    const completedUnbilled = customerVisits.filter(
      (visit) => visit.status === 'completed' && !invoiceByVisit.has(visit.id),
    );
    if (completedUnbilled.length === 0) continue;

    const groups = [];
    if (customer?.billing?.mode === 'monthly_batch') {
      const byMonth = new Map();
      for (const visit of completedUnbilled) {
        const key = monthKey(visit.scheduledStart) ?? 'unknown';
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key).push(visit);
      }
      for (const [key, groupedVisits] of byMonth) groups.push({ key, visits: groupedVisits });
    } else {
      for (const visit of completedUnbilled) {
        groups.push({ key: monthKey(visit.scheduledStart) ?? visit.id, visits: [visit] });
      }
    }

    for (const group of groups) {
      const groupedVisits = group.visits.sort(sortByScheduledStart);
      const base = itemBase(customer, groupedVisits);
      if (issuerMissing) {
        items.push({ ...base, status: 'needs_info', reasonCode: 'missing_issuer_profile' });
        continue;
      }
      const missingField = missingCustomerField(customer);
      if (missingField) {
        items.push({ ...base, status: 'needs_info', reasonCode: missingField });
        continue;
      }

      const missingEvidence = missingVisitEvidence(groupedVisits);
      if (missingEvidence) {
        items.push({
          ...base,
          status: 'needs_info',
          reasonCode: 'missing_actuals',
          visitId: missingEvidence.id,
        });
        continue;
      }

      if (customer.billing.mode === 'monthly_batch') {
        const latestCompleted = groupedVisits.at(-1);
        const futureSameWindow = customerVisits.find((visit) =>
          visit.status === 'planned'
          && !invoiceByVisit.has(visit.id)
          && monthKey(visit.scheduledStart) === group.key
          && String(visit.scheduledStart) > String(latestCompleted.scheduledStart),
        );

        if (futureSameWindow) {
          items.push({
            ...base,
            status: 'waiting',
            reasonCode: 'future_visit_same_window',
            nextVisitId: futureSameWindow.id,
            nextVisitAt: futureSameWindow.scheduledStart,
          });
          continue;
        }
      }

      items.push({ ...base, status: 'ready', reasonCode: 'billing_window_closed' });
    }
  }

  const rank = { ready: 0, waiting: 1, needs_info: 2, invoiced: 3 };
  items.sort((a, b) => (rank[a.status] ?? 99) - (rank[b.status] ?? 99)
    || String(a.customerName ?? '').localeCompare(String(b.customerName ?? '')));

  return {
    items,
    summary: {
      ready: items.filter((item) => item.status === 'ready').length,
      waiting: items.filter((item) => item.status === 'waiting').length,
      needsInfo: items.filter((item) => item.status === 'needs_info').length,
      invoiced: items.filter((item) => item.status === 'invoiced').length,
    },
  };
}
