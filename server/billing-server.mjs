import { API_VERSION, readJson, sendJson } from './http-utils.mjs';
import { handleBillingDelivery } from './billing-delivery.mjs';
import { composeInvoiceEmail, createSmtpBillingDeliveryAdapter, smtpBillingDeliveryAdapterFromEnv } from './billing-email-adapter.mjs';
import { createActionGuard, assertActorCapability } from '../src/action-guard.mjs';
import { authSecretFromEnv } from '../src/auth/magic-link.mjs';
import { getUser, updateCapabilities } from '../src/user/user-store.mjs';
import { createRequestScope } from './request-scope.mjs';
import { evaluateBilling } from '../src/billing/readiness.mjs';
import { renderInvoicePdf } from '../src/billing/artifact.mjs';
import { DOCUMENT_PROFILES, buildInvoiceDocument, validateInvoiceDocument } from '../src/billing/document-profile.mjs';
import { renderPeppolBis3Ubl } from '../src/billing/peppol-bis3.mjs';
import { syncBillingSource } from '../src/billing/source-sync.mjs';
import {
  recordBillingActual,
  correctBillingActual,
  createBillingDraft,
  createManualBillingDraft,
  updateManualBillingDraft,
  createBillingCustomer,
  updateBillingCustomer,
  createBillingProduct,
  updateBillingProduct,
  issueBillingInvoice,
  voidBillingInvoice,
  recordBillingPayment,
  beginBillingDelivery,
  deliverBillingInvoice,
  failBillingDelivery,
  remindBillingInvoice,
  updateBillingSettings,
  requestBillingApproval,
  approveBillingInvoice,
  rejectBillingApproval,
} from '../src/billing/mutations.mjs';
import {
  createRecurringInvoice,
  updateRecurringInvoice,
  deleteRecurringInvoice,
  tickRecurringScheduler,
} from '../src/billing/recurring.mjs';
import { computeReport } from '../src/billing/reports.mjs';

function apiError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 422;
  sendJson(res, status, { error: error?.code || 'billing_request_failed' });
}

function reportToCsv(report) {
  const DANGEROUS_CSV_LEAD = /^[=+\-@\t\r]/;
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    // P1-11: check original leading char BEFORE quoting
    const dangerous = DANGEROUS_CSV_LEAD.test(s);
    const quoted = /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    return dangerous ? `'${quoted}` : quoted;
  };
  const rows = [];
  if (report.type === 'revenue-by-customer') {
    rows.push(['Kunde', 'Kunde-ID', 'Fakturaer', 'Betalt (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.customerName, r.customerId, r.invoiceCount, r.totalPaidMinor].map(esc).join(','));
    }
  } else if (report.type === 'revenue-by-period') {
    rows.push(['Periode', 'Beløb (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.period, r.amountMinor].map(esc).join(','));
    }
  } else if (report.type === 'vat-overview') {
    rows.push(['Netto (øre)', 'Moms (øre)', 'Brutto (øre)'].map(esc).join(','));
    rows.push([report.totalNetMinor, report.totalTaxMinor, report.totalGrossMinor].map(esc).join(','));
  } else if (report.type === 'days-to-pay') {
    rows.push(['Faktura', 'Kunde', 'Dage', 'Beløb (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.invoiceNumber || r.invoiceId, r.customerName, r.days, r.amountMinor].map(esc).join(','));
    }
  } else if (report.type === 'outstanding-aging') {
    rows.push(['Aldersgruppe', 'Label', 'Antal', 'Beløb (øre)'].map(esc).join(','));
    for (const r of (report.rows || [])) {
      rows.push([r.bucket, r.label, r.count, r.amountMinor].map(esc).join(','));
    }
  } else {
    rows.push(['Type', 'Fejl'].map(esc).join(','));
    rows.push([report.type, report.error || ''].map(esc).join(','));
  }
  return '\uFEFF' + rows.join('\n'); // BOM for Excel Danish locale
}

function isBillingPath(pathname) {
  return pathname === '/api/v1/billing'
    || pathname === '/api/v1/billing/settings'
    || pathname === '/api/v1/billing/sync'
    || pathname === '/api/v1/billing/customers'
    || pathname === '/api/v1/billing/actuals'
    || pathname === '/api/v1/billing/actuals/correct'
    || pathname === '/api/v1/billing/invoices/draft'
    || pathname === '/api/v1/billing/dashboard'
    || pathname === '/api/v1/billing/audit'
    || pathname === '/api/v1/billing/query'
    || pathname === '/api/v1/billing/invoices/manual-draft'
    || /^\/api\/v1\/billing\/invoices\/[^/]+\/(issue|artifact|document|peppol-bis3|deliver|send-email|email-preview|void|payment|remind|request-approval|approve|reject-approval)$/.test(pathname)
    || /^\/api\/v1\/billing\/invoices\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/billing\/customers\/[^/]+$/.test(pathname)
    || pathname === '/api/v1/billing/products'
    || /^\/api\/v1\/billing\/products\/[^/]+$/.test(pathname)
    || pathname === '/api/v1/billing/recurring'
    || /^\/api\/v1\/billing\/recurring\/[^/]+$/.test(pathname)
    || pathname === '/api/v1/billing/recurring/tick'
    || pathname === '/api/v1/billing/reports';
}

function queryBilling(billing, params = {}) {
  const type = params.type === 'customer' ? 'customer' : 'invoice';
  const search = (params.search || '').trim().toLowerCase();
  const status = params.status || null;
  const dateFrom = params.dateFrom || null;
  const dateTo = params.dateTo || null;
  const customerId = params.customerId || null;
  const sortBy = params.sortBy || (type === 'invoice' ? 'issuedAt' : 'name');
  const sortOrder = params.sortOrder === 'asc' ? 'asc' : 'desc';
  const limit = Math.min(Math.max(Number.parseInt(params.limit, 10) || 25, 1), 200);
  const offset = Math.max(Number.parseInt(params.offset, 10) || 0, 0);

  const invoices = billing.invoices || [];
  const customers = billing.customers || [];
  const customersById = new Map(customers.map((c) => [c.id, c]));

  let items = [];
  if (type === 'invoice') {
    for (const inv of invoices) {
      if (!inv || inv.status === 'void') continue;
      const customer = customersById.get(inv.customerId);
      const paid = (inv.payments || []).reduce((s, p) => s + (p.amountMinor || 0), 0);
      const outstanding = (inv.totalGrossMinor || 0) - paid;
      const derivedStatus = inv.status === 'draft' ? 'draft'
        : outstanding <= 0 ? 'paid'
        : inv.dueDate && new Date(inv.dueDate) < new Date() ? 'overdue'
        : 'issued';
      items.push({
        id: inv.id,
        number: inv.number || null,
        customerId: inv.customerId,
        customerName: customer?.name || inv.customerId,
        status: derivedStatus,
        issuedAt: inv.issuedAt || inv.createdAt || null,
        dueDate: inv.dueDate || null,
        totalGrossMinor: inv.totalGrossMinor || 0,
        outstandingMinor: outstanding,
        currency: inv.currency || customer?.billing?.currency || 'DKK',
      });
    }
  } else {
    // P1-9: pre-index invoices by customerId to eliminate O(n*m) nested filter
    const invoicesByCustomer = new Map();
    for (const inv of invoices) {
      if (!inv || inv.status === 'void') continue;
      let bucket = invoicesByCustomer.get(inv.customerId);
      if (!bucket) { bucket = []; invoicesByCustomer.set(inv.customerId, bucket); }
      bucket.push(inv);
    }
    for (const cust of customers) {
      if (!cust) continue;
      const custInvoices = invoicesByCustomer.get(cust.id) || [];
      const invoiceCount = custInvoices.length;
      const totalBilled = custInvoices.reduce((s, i) => s + (i.totalGrossMinor || 0), 0);
      items.push({
        id: cust.id,
        name: cust.name || '',
        email: cust.email || '',
        address: cust.address || '',
        status: cust.status || 'active',
        billingMode: cust.billing?.mode || null,
        rateMinor: cust.billing?.rateMinor || null,
        currency: cust.billing?.currency || 'DKK',
        invoiceCount,
        totalBilledMinor: totalBilled,
        createdAt: cust.createdAt || null,
      });
    }
  }

  // Filter by status
  if (status) {
    items = items.filter((item) => item.status === status);
  }

  // Filter by customerId (invoices only)
  if (customerId && type === 'invoice') {
    items = items.filter((item) => item.customerId === customerId);
  }

  // Filter by date range
  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo).setHours(23, 59, 59, 999) : Infinity;
    items = items.filter((item) => {
      const d = new Date(type === 'invoice' ? item.issuedAt : item.createdAt).getTime();
      return Number.isFinite(d) && d >= from && d <= to;
    });
  }

  // Text search
  if (search) {
    items = items.filter((item) => {
      if (type === 'invoice') {
        return (item.number || '').toLowerCase().includes(search)
          || item.customerName.toLowerCase().includes(search)
          || item.id.toLowerCase().includes(search);
      }
      return item.name.toLowerCase().includes(search)
        || item.email.toLowerCase().includes(search)
        || item.id.toLowerCase().includes(search);
    });
  }

  // Sort
  items.sort((a, b) => {
    let va = a[sortBy];
    let vb = b[sortBy];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va < vb) return sortOrder === 'asc' ? -1 : 1;
    if (va > vb) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const total = items.length;
  const sliced = items.slice(offset, offset + limit);

  return {
    type,
    items: sliced,
    total,
    limit,
    offset,
    hasMore: offset + limit < total,
  };
}

function projectBillingState(billing) {
  return {
    ...billing,
    projection: evaluateBilling({ ...billing, now: new Date().toISOString() }),
  };
}

function ensureDemoBillingCapability() {
  const demo = getUser('demo-user');
  if (!demo) return;
  const caps = new Set(demo.capabilities);
  let changed = false;
  if (!caps.has('billing.read')) { caps.add('billing.read'); changed = true; }
  if (!caps.has('billing.manage')) { caps.add('billing.manage'); changed = true; }
  if (!caps.has('billing.approve')) { caps.add('billing.approve'); changed = true; }
  if (changed) updateCapabilities('demo-user', [...caps]);
}

function actorError(code, status, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

/**
 * Decorate the Studio HTTP server with an extraction-ready billing API without
 * forking the canonical workspace server. Non-billing requests are delegated
 * byte-for-byte to the original request listener.
 */
export function decorateBillingServer(server, {
  authSecret = null,
  requireAuth = process.env.AFTERGRAPH_REQUIRE_AUTH === 'true',
  billingDeliveryAdapter = null,
  billingDocumentValidator = null,
  smtpDeliveryAdapter = null,
} = {}) {
  const resolvedSmtpAdapter = smtpDeliveryAdapter || smtpBillingDeliveryAdapterFromEnv();
  const originals = server.listeners('request');
  if (originals.length === 0) throw new Error('billing decorator requires a request listener');
  const secret = authSecret || authSecretFromEnv();
  const actionGuard = createActionGuard();
  const users = { getUser };

  if (!requireAuth) ensureDemoBillingCapability();
  server.removeAllListeners('request');

  const resolveScope = (req, url, claimedActor = undefined) => {
    const storeFor = (actor) => {
      const workspaceId = getUser(actor)?.workspaceId || actor;
      return workspaceId === 'demo-user'
        ? server.workspace.store
        : server.workspace.storeFor(workspaceId);
    };
    return createRequestScope({
      req, url, secret, requireAuth, storeFor, claimedActor,
    });
  };

  const begin = (req, body, actor, store, path, capability = 'billing.manage') => {
    try { assertActorCapability({ state: store.snapshot(), actor, capability, users }); }
    catch { throw actorError('forbidden', 403); }
    const supplied = req.headers['idempotency-key'] || body?.idempotencyKey;
    if (!supplied) throw actorError('idempotency_key_required', 422);
    const key = `${actor}:${req.method}:${path}:${supplied}`;
    try { actionGuard.begin(key); }
    catch { throw actorError('idempotency_conflict', 409); }
    return key;
  };

  const handle = async (req, res, url) => {
    if (url.pathname === '/api/v1/billing' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      sendJson(res, 200, {
        version: API_VERSION,
        billing: projectBillingState(store.snapshot().billing),
      });
      return;
    }

    if (url.pathname === '/api/v1/billing/dashboard' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const billing = store.snapshot().billing || {};
      const invoices = billing.invoices || [];
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let totalOutstandingMinor = 0;
      let overdueCount = 0;
      let monthlyRevenueMinor = 0;
      const recentPayments = [];
      for (const invoice of invoices) {
        if (invoice.status === 'void') continue;
        const paid = (invoice.payments || []).reduce((sum, p) => sum + (p.amountMinor || 0), 0);
        const outstanding = (invoice.totalGrossMinor || 0) - paid;
        if (outstanding > 0) {
          totalOutstandingMinor += outstanding;
          if (invoice.dueDate && new Date(invoice.dueDate) < now) overdueCount++;
        }
        for (const payment of (invoice.payments || [])) {
          if (payment.paidAt >= currentMonthStart) monthlyRevenueMinor += payment.amountMinor || 0;
          recentPayments.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.number || null,
            customerName: (billing.customers || []).find(c => c.id === invoice.customerId)?.name || null,
            amountMinor: payment.amountMinor,
            paidAt: payment.paidAt,
            method: payment.method || null,
          });
        }
      }
      recentPayments.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
      sendJson(res, 200, {
        version: API_VERSION,
        dashboard: {
          totalOutstandingMinor,
          overdueCount,
          monthlyRevenueMinor,
          currency: billing.settings?.currency || 'DKK',
          recentPayments: recentPayments.slice(0, 10),
          generatedAt: now.toISOString(),
        },
      });
      return;
    }

    if (url.pathname === '/api/v1/billing/query' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const billing = store.snapshot().billing || {};
      const params = Object.fromEntries(url.searchParams.entries());
      const result = queryBilling(billing, params);
      sendJson(res, 200, { version: API_VERSION, ...result });
      return;
    }

    const artifactMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/artifact$/);
    if (artifactMatch && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const artifact = renderInvoicePdf({ billing: store.snapshot().billing, invoiceId: decodeURIComponent(artifactMatch[1]) });
      res.statusCode = 200;
      res.setHeader('content-type', artifact.contentType);
      res.setHeader('content-disposition', `attachment; filename=\"${artifact.filename}\"`);
      res.setHeader('content-length', artifact.body.length);
      res.setHeader('cache-control', 'no-store');
      res.end(artifact.body);
      return;
    }

    const documentMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/document$/);
    if (documentMatch && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const document = buildInvoiceDocument({ billing: store.snapshot().billing, invoiceId: decodeURIComponent(documentMatch[1]) });
      sendJson(res, 200, { version: API_VERSION, document });
      return;
    }

    const peppolMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/peppol-bis3$/);
    if (peppolMatch && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const document = buildInvoiceDocument({ billing: store.snapshot().billing, invoiceId: decodeURIComponent(peppolMatch[1]) });
      const profile = 'peppol-bis-3.0-2026-05';
      const preflight = validateInvoiceDocument(document, { profile });
      if (!preflight.ok) {
        sendJson(res, 422, { error: 'document_profile_validation_failed', profile, errors: preflight.errors });
        return;
      }
      const descriptor = DOCUMENT_PROFILES[profile];
      if (descriptor?.externalValidationRequired && typeof billingDocumentValidator !== 'function') {
        sendJson(res, 503, { error: 'document_validator_unavailable', profile });
        return;
      }
      const xml = renderPeppolBis3Ubl(document);
      if (descriptor?.externalValidationRequired) {
        let external;
        try {
          external = await billingDocumentValidator({ profile, document, xml });
        } catch {
          sendJson(res, 503, { error: 'document_validator_unavailable', profile });
          return;
        }
        if (!external?.ok) {
          sendJson(res, 422, {
            error: 'document_external_validation_failed',
            profile,
            errors: external?.errors || ['external_validation_failed'],
          });
          return;
        }
      }
      res.statusCode = 200;
      res.setHeader('content-type', 'application/xml; charset=utf-8');
      res.setHeader('cache-control', 'no-store');
      res.end(xml);
      return;
    }

    if (url.pathname === '/api/v1/billing/products' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const billing = store.snapshot().billing || {};
      const products = billing.products || [];
      sendJson(res, 200, { version: API_VERSION, products });
      return;
    }

    // ponytail: GET-only routes that don't need body parsing must be above the
    // readJson/actor gate so they aren't blocked by missing body.actor.
    if (url.pathname === '/api/v1/billing/recurring' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const billing = store.snapshot().billing || {};
      sendJson(res, 200, { version: API_VERSION, recurringInvoices: billing.recurringInvoices || [] });
      return;
    }

    if (url.pathname === '/api/v1/billing/reports' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const params = Object.fromEntries(url.searchParams.entries());
      const type = params.type;
      if (!type) {
        sendJson(res, 422, { error: 'report_type_required' });
        return;
      }
      const snapshot = store.snapshot();
      const billing = snapshot.billing || {};
      const report = computeReport({
        invoices: billing.invoices || [],
        customers: billing.customers || [],
        type,
        dateFrom: params.dateFrom || null,
        dateTo: params.dateTo || null,
        granularity: params.granularity || 'month',
      });
      if (report.error) {
        sendJson(res, 422, { error: report.error });
        return;
      }
      const accept = (req.headers.accept || '').toLowerCase();
      if (accept.includes('text/csv')) {
        const csv = reportToCsv(report);
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${type}-report.csv"`,
        });
        res.end(csv);
        return;
      }
      sendJson(res, 200, { version: API_VERSION, report });
      return;
    }

    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const { actor, store } = await resolveScope(req, url, body.actor);

    // Audit log endpoint: fire-and-forget logging of destructive actions
    if (url.pathname === '/api/v1/billing/audit' && req.method === 'POST') {
      const capability = 'billing.manage';
      try { assertActorCapability({ state: store.snapshot(), actor, capability, users }); }
      catch { throw actorError('forbidden', 403); }
      const entry = {
        actor,
        action: body.action || 'unknown',
        timestamp: new Date().toISOString(),
        details: body.details || {},
        invoiceId: body.invoiceId || null,
        invoiceNumber: body.invoiceNumber || null,
      };
      // Append to billing.auditLog array in store
      await store.mutate((draft) => {
        if (!draft.billing) draft.billing = {};
        if (!Array.isArray(draft.billing.auditLog)) draft.billing.auditLog = [];
        draft.billing.auditLog.push(entry);
        // Time-based pruning: remove entries older than 90 days
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        draft.billing.auditLog = draft.billing.auditLog.filter((e) => e.timestamp >= cutoff);
        // Bounded memory: keep last 1000 entries max
        if (draft.billing.auditLog.length > 1000) {
          draft.billing.auditLog = draft.billing.auditLog.slice(-1000);
        }
        return draft;
      });
      sendJson(res, 200, { ok: true });
      return;
    }

    const capability = url.pathname === '/api/v1/billing/sync'
      ? 'billing.sync'
      : url.pathname === '/api/v1/billing/actuals/correct'
        ? 'billing.actuals.correct'
        : url.pathname === '/api/v1/billing/reports'
          ? 'billing.read'
          : 'billing.manage';
    const actionKey = begin(req, body, actor, store, url.pathname, capability);

    try {
      if (url.pathname === '/api/v1/billing/sync' && req.method === 'POST') {
        let sync;
        const next = await store.mutate((draft) => {
          const result = syncBillingSource(draft.billing, { schema: body.schema, source: body.source, customers: body.customers, visits: body.visits });
          draft.billing = result.billing;
          sync = { sourceId: body.source.id, revision: body.source.revision, ...result.summary };
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', sourceId: sync.sourceId, revision: sync.revision });
        sendJson(res, 200, { version: API_VERSION, sync, billing: projectBillingState(next.billing) });
        return;
      }

      if (url.pathname === '/api/v1/billing/customers' && req.method === 'POST') {
        let customer;
        const next = await store.mutate((draft) => {
          const result = createBillingCustomer(draft.billing, {
            id: body.id,
            name: body.name,
            address: body.address,
            email: body.email,
            countryCode: body.countryCode,
            registrationId: body.registrationId,
            registrationScheme: body.registrationScheme,
            billing: body.billing,
            actor,
          });
          draft.billing = result.billing;
          customer = result.customer;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', customerId: customer.id });
        sendJson(res, 201, {
          version: API_VERSION,
          customer,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      if (url.pathname === '/api/v1/billing/settings' && req.method === 'POST') {
        let settings;
        const next = await store.mutate((draft) => {
          const result = updateBillingSettings(draft.billing, {
            issuer: body.issuer,
            defaultServiceLabel: body.defaultServiceLabel,
            invoiceSequence: body.invoiceSequence,
            approvalPolicy: body.approvalPolicy,
          });
          draft.billing = result.billing;
          settings = result.settings;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', settingsUpdated: true });
        sendJson(res, 200, { version: API_VERSION, settings, billing: projectBillingState(next.billing) });
        return;
      }

      if (url.pathname === '/api/v1/billing/actuals/correct' && req.method === 'POST') {
        let visit;
        const next = await store.mutate((draft) => {
          const result = correctBillingActual(draft.billing, {
            visitId: body.visitId,
            actual: body.actual,
            actor,
            reason: body.reason,
            correctionId: actionKey,
            correctedAt: body.correctedAt,
          });
          draft.billing = result.billing;
          visit = result.visit;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', visitId: visit.id, corrected: true });
        sendJson(res, 200, {
          version: API_VERSION,
          visit,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      if (url.pathname === '/api/v1/billing/actuals' && req.method === 'POST') {
        let visit;
        const next = await store.mutate((draft) => {
          const result = recordBillingActual(draft.billing, { visitId: body.visitId, actual: body.actual });
          draft.billing = result.billing;
          visit = result.visit;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', visitId: visit.id });
        sendJson(res, 200, {
          version: API_VERSION,
          visit,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      if (url.pathname === '/api/v1/billing/invoices/draft' && req.method === 'POST') {
        let invoice;
        const next = await store.mutate((draft) => {
          const result = createBillingDraft(draft.billing, {
            customerId: body.customerId,
            visitIds: body.visitIds,
            number: body.number,
            issueDate: body.issueDate,
            actor,
          });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 201, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      if (url.pathname === '/api/v1/billing/invoices/manual-draft' && req.method === 'POST') {
        let invoice;
        const next = await store.mutate((draft) => {
          const result = createManualBillingDraft(draft.billing, {
            customerId: body.customerId,
            lines: body.lines,
            number: body.number,
            issueDate: body.issueDate,
            actor,
          });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 201, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const invoiceUpdateMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)$/);
      if (invoiceUpdateMatch && req.method === 'PATCH') {
        const invoiceId = decodeURIComponent(invoiceUpdateMatch[1]);
        let invoice;
        const next = await store.mutate((draft) => {
          const result = updateManualBillingDraft(draft.billing, {
            invoiceId,
            lines: body.lines,
            issueDate: body.issueDate,
            actor,
          });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 200, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const issueMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/issue$/);
      if (issueMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(issueMatch[1]);
        let invoice;
        const next = await store.mutate((draft) => {
          const result = issueBillingInvoice(draft.billing, { invoiceId, actor });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 200, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const requestApprovalMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/request-approval$/);
      if (requestApprovalMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(requestApprovalMatch[1]);
        try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.manage', users }); }
        catch { throw actorError('forbidden', 403); }
        let invoice;
        const next = await store.mutate((draft) => {
          const result = requestBillingApproval(draft.billing, { invoiceId, actor });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 200, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const approveMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/approve$/);
      if (approveMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(approveMatch[1]);
        try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.approve', users }); }
        catch { throw actorError('forbidden', 403); }
        const user = getUser(actor);
        const permissions = user?.capabilities || [];
        let invoice;
        const next = await store.mutate((draft) => {
          const result = approveBillingInvoice(draft.billing, { invoiceId, actor, permissions });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 200, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const rejectApprovalMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/reject-approval$/);
      if (rejectApprovalMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(rejectApprovalMatch[1]);
        try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.approve', users }); }
        catch { throw actorError('forbidden', 403); }
        const user = getUser(actor);
        const permissions = user?.capabilities || [];
        const reason = body?.reason || '';
        let invoice;
        const next = await store.mutate((draft) => {
          const result = rejectBillingApproval(draft.billing, { invoiceId, actor, reason, permissions });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
        sendJson(res, 200, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const emailPreviewMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/email-preview$/);
      if (emailPreviewMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(emailPreviewMatch[1]);
        try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
        catch { throw actorError('forbidden', 403); }
        const snapshot = store.snapshot().billing;
        const invoice = snapshot.invoices?.find((i) => i.id === invoiceId);
        if (!invoice) throw actorError('invoice_not_found', 404);
        const customer = snapshot.customers?.find((c) => c.id === invoice.customerId);
        const recipientEmail = invoice.customerSnapshot?.email || customer?.email || null;
        if (!recipientEmail) throw actorError('delivery_recipient_missing', 422);
        const issuer = invoice.issuerSnapshot || snapshot.settings?.issuer || {};
        const { subject, text, html } = composeInvoiceEmail({ invoice, customer, issuer });
        sendJson(res, 200, {
          version: API_VERSION,
          preview: {
            invoiceId,
            recipientEmail,
            subject,
            text,
            html,
            attachmentFilename: `invoice-${String(invoice.number || invoiceId).replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf`,
          },
        });
        return;
      }

      const sendEmailMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/send-email$/);
      if (sendEmailMatch && req.method === 'POST') {
        if (!resolvedSmtpAdapter?.name || typeof resolvedSmtpAdapter.deliver !== 'function') {
          throw actorError('smtp_delivery_unavailable', 503);
        }
        const invoiceId = decodeURIComponent(sendEmailMatch[1]);
        await handleBillingDelivery({
          store,
          invoiceId,
          actor,
          adapter: resolvedSmtpAdapter,
          actionKey,
          actionGuard,
          res,
        });
        return;
      }

      const deliverMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/deliver$/);
      if (deliverMatch && req.method === 'POST') {
        if (!billingDeliveryAdapter?.name || typeof billingDeliveryAdapter.deliver !== 'function') {
          throw actorError('delivery_provider_unavailable', 503);
        }
        const invoiceId = decodeURIComponent(deliverMatch[1]);
        await handleBillingDelivery({
          store,
          invoiceId,
          actor,
          adapter: billingDeliveryAdapter,
          actionKey,
          actionGuard,
          res,
        });
        return;
      }

      const customerUpdateMatch = url.pathname.match(/^\/api\/v1\/billing\/customers\/([^/]+)$/);
      if (customerUpdateMatch && req.method === 'PATCH') {
        const customerId = decodeURIComponent(customerUpdateMatch[1]);
        let customer;
        const next = await store.mutate((draft) => {
          const result = updateBillingCustomer(draft.billing, {
            id: customerId,
            name: body.name,
            address: body.address,
            email: body.email,
            countryCode: body.countryCode,
            registrationId: body.registrationId,
            registrationScheme: body.registrationScheme,
            billing: body.billing,
            actor,
          });
          draft.billing = result.billing;
          customer = result.customer;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', customerId: customer.id });
        sendJson(res, 200, {
          version: API_VERSION,
          customer,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const voidMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/void$/);
      if (voidMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(voidMatch[1]);
        let invoice;
        const next = await store.mutate((draft) => {
          const result = voidBillingInvoice(draft.billing, { invoiceId, actor, reason: body.reason });
          draft.billing = result.billing;
          invoice = result.invoice;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id, voided: true });
        sendJson(res, 200, {
          version: API_VERSION,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const paymentMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/payment$/);
      if (paymentMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(paymentMatch[1]);
        let invoice;
        let payment;
        const next = await store.mutate((draft) => {
          const result = recordBillingPayment(draft.billing, {
            invoiceId,
            amountMinor: body.amountMinor,
            method: body.method,
            reference: body.reference,
            paidAt: body.paidAt,
            actor,
          });
          draft.billing = result.billing;
          invoice = result.invoice;
          payment = result.payment;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id, paymentId: payment.id });
        sendJson(res, 201, {
          version: API_VERSION,
          payment,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const remindMatch = url.pathname.match(/^\/api\/v1\/billing\/invoices\/([^/]+)\/remind$/);
      if (remindMatch && req.method === 'POST') {
        const invoiceId = decodeURIComponent(remindMatch[1]);
        let invoice;
        let reminder;
        const next = await store.mutate((draft) => {
          const result = remindBillingInvoice(draft.billing, {
            invoiceId,
            actor,
          });
          draft.billing = result.billing;
          invoice = result.invoice;
          reminder = result.reminder;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id, reminderId: reminder.id });
        sendJson(res, 201, {
          version: API_VERSION,
          reminder,
          invoice,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      if (url.pathname === '/api/v1/billing/products' && req.method === 'POST') {
        let product;
        const next = await store.mutate((draft) => {
          const result = createBillingProduct(draft.billing, {
            id: body.id,
            name: body.name,
            description: body.description,
            unitPriceMinor: body.unitPriceMinor,
            vatRateBps: body.vatRateBps,
            category: body.category,
            sku: body.sku,
            active: body.active,
            actor,
          });
          draft.billing = result.billing;
          product = result.product;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', productId: product.id });
        sendJson(res, 201, {
          version: API_VERSION,
          product,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const productMatch = url.pathname.match(/^\/api\/v1\/billing\/products\/([^/]+)$/);
      if (productMatch && req.method === 'PATCH') {
        const productId = decodeURIComponent(productMatch[1]);
        let product;
        const next = await store.mutate((draft) => {
          const result = updateBillingProduct(draft.billing, {
            id: productId,
            name: body.name,
            description: body.description,
            unitPriceMinor: body.unitPriceMinor,
            vatRateBps: body.vatRateBps,
            category: body.category,
            sku: body.sku,
            active: body.active,
            actor,
          });
          draft.billing = result.billing;
          product = result.product;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', productId: product.id });
        sendJson(res, 200, {
          version: API_VERSION,
          product,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      // --- Recurring billing endpoints ---
      if (url.pathname === '/api/v1/billing/recurring' && req.method === 'POST') {
        let recurring;
        const next = await store.mutate((draft) => {
          const result = createRecurringInvoice(draft.billing, {
            customerId: body.customerId,
            productLines: body.productLines,
            schedule: body.schedule,
            actor,
          });
          draft.billing = result.billing;
          recurring = result.recurring;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', recurringId: recurring.id });
        sendJson(res, 201, {
          version: API_VERSION,
          recurring,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      const recurringMatch = url.pathname.match(/^\/api\/v1\/billing\/recurring\/([^/]+)$/);
      if (recurringMatch && req.method === 'PATCH') {
        const recurringId = decodeURIComponent(recurringMatch[1]);
        // ponytail: use outer actionKey from line 536 — do NOT redeclare/shadow
        let recurring;
        const next = await store.mutate((draft) => {
          const result = updateRecurringInvoice(draft.billing, {
            id: recurringId,
            productLines: body.productLines,
            schedule: body.schedule,
            active: body.active,
            actor,
          });
          draft.billing = result.billing;
          recurring = result.recurring;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', recurringId: recurring.id });
        sendJson(res, 200, {
          version: API_VERSION,
          recurring,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      if (recurringMatch && req.method === 'DELETE') {
        const recurringId = decodeURIComponent(recurringMatch[1]);
        // ponytail: use outer actionKey from line 536 — do NOT redeclare/shadow
        const next = await store.mutate((draft) => {
          const result = deleteRecurringInvoice(draft.billing, { id: recurringId, actor });
          draft.billing = result.billing;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', recurringId });
        sendJson(res, 200, {
          version: API_VERSION,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      if (url.pathname === '/api/v1/billing/recurring/tick' && req.method === 'POST') {
        let generated;
        const next = await store.mutate((draft) => {
          const result = tickRecurringScheduler(draft.billing, {
            now: body.now,
            actor,
          });
          draft.billing = result.billing;
          generated = result.generated;
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', generatedCount: generated.length });
        sendJson(res, 200, {
          version: API_VERSION,
          generated,
          billing: projectBillingState(next.billing),
        });
        return;
      }

      // ── Reports ──────────────────────────────────────────────────────────
      if (url.pathname === '/api/v1/billing/reports' && req.method === 'POST') {
        const type = body?.type;
        if (!type) {
          sendJson(res, 422, { error: 'report_type_required' });
          return;
        }
        const snapshot = store.snapshot();
        const billing = snapshot.billing || {};
        const report = computeReport({
          invoices: billing.invoices || [],
          customers: billing.customers || [],
          type,
          dateFrom: body.dateFrom || null,
          dateTo: body.dateTo || null,
          granularity: body.granularity || 'month',
        });
        if (report.error) {
          sendJson(res, 422, { error: report.error });
          return;
        }
        sendJson(res, 200, { version: API_VERSION, report });
        return;
      }

      actionGuard.fail(actionKey, 'billing api not found');
      sendJson(res, 404, { error: 'api_not_found' });
    } catch (error) {
      actionGuard.fail(actionKey, error?.message || error);
      throw error;
    }
  };

  server.on('request', async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (!isBillingPath(url.pathname)) {
      for (const listener of originals) listener.call(server, req, res);
      return;
    }
    try { await handle(req, res, url); }
    catch (error) { apiError(res, error); }
  });

  // ── Recurring scheduler auto-tick ───────────────────────────────────────
  // ponytail: per-tenant scheduler ticks each registered store independently.
  // The previous __scheduler__ phantom store wrote drafts nowhere visible.
  // Now we iterate all live tenant stores; each tick is idempotent via nextRunAt.
  let schedulerTimer = null;
  let schedulerRunning = false;
  const SCHEDULER_INTERVAL_MS = Number.parseInt(process.env.BILLING_SCHEDULER_INTERVAL_MS || '60000', 10);
  if (SCHEDULER_INTERVAL_MS > 0 && !process.env.BILLING_SCHEDULER_DISABLED) {
    schedulerTimer = setInterval(async () => {
      // Concurrency guard: skip if previous tick is still running
      if (schedulerRunning) return;
      schedulerRunning = true;
      try {
        const tenantStores = server.workspace?.stores;
        if (!tenantStores || typeof tenantStores.forEach !== 'function') return;
        for (const [, entry] of tenantStores) {
          try {
            await entry.mutate((draft) => {
              const result = tickRecurringScheduler(draft.billing, { actor: 'scheduler' });
              draft.billing = result.billing;
              return draft;
            });
          } catch (err) {
            console.error('[scheduler] auto-tick failed for tenant store:', err?.message || err);
          }
        }
      } finally {
        schedulerRunning = false;
      }
    }, SCHEDULER_INTERVAL_MS);
    if (schedulerTimer.unref) schedulerTimer.unref();
  }

  // ponytail: clear scheduler timer on close to prevent leaks in test harnesses
  const originalClose = server.close.bind(server);
  server.close = (callback) => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
    }
    return originalClose(callback);
  };

  return server;
}
