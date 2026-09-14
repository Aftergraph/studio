/**
 * Slim billing server: middleware setup + route registration via trie router.
 * All route handlers live in server/routes/*.mjs modules.
 */
import { API_VERSION, readJson, sendJson } from './http-utils.mjs';
import { handleBillingDelivery } from './billing-delivery.mjs';
import { smtpBillingDeliveryAdapterFromEnv } from './billing-email-adapter.mjs';
import { createActionGuard, assertActorCapability } from '../src/action-guard.mjs';
import { authSecretFromEnv } from '../src/auth/magic-link.mjs';
import { getUser, updateCapabilities } from '../src/user/user-store.mjs';
import { createRequestScope } from './request-scope.mjs';
import { evaluateBilling } from '../src/billing/readiness.mjs';
import { syncBillingSource } from '../src/billing/source-sync.mjs';
import { recordBillingActual, correctBillingActual } from '../src/billing/mutations.mjs';
import { tickRecurringScheduler } from '../src/billing/recurring.mjs';
import { TrieRouter } from './trie-router.mjs';
import { requestIdMiddleware } from './middleware/request-id.mjs';

import { register as registerInvoices } from './routes/invoices.mjs';
import { register as registerCustomers } from './routes/customers.mjs';
import { register as registerProducts } from './routes/products.mjs';
import { register as registerRecurring } from './routes/recurring.mjs';
import { register as registerReports } from './routes/reports.mjs';
import { register as registerSettings } from './routes/settings.mjs';

function projectBillingState(billing) {
  return { ...billing, projection: evaluateBilling({ ...billing, now: new Date().toISOString() }) };
}

async function ensureDemoBillingCapability() {
  const demo = getUser('demo-user');
  if (!demo) return;
  const caps = new Set(demo.capabilities || []);
  let changed = false;
  if (!caps.has('billing.read')) { caps.add('billing.read'); changed = true; }
  if (!caps.has('billing.manage')) { caps.add('billing.manage'); changed = true; }
  if (!caps.has('billing.approve')) { caps.add('billing.approve'); changed = true; }
  if (changed) {
    const result = updateCapabilities('demo-user', [...caps]);
    if (result && typeof result.then === 'function') await result;
  }
}

function billingError(code, status, message = code) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}
const actorError = billingError;

function apiError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 422;
  sendJson(res, status, { error: error?.code || 'billing_request_failed' });
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

  if (!requireAuth) {
    ensureDemoBillingCapability().catch((err) => {
      console.error('[billing] ensureDemoBillingCapability failed:', err?.message || err);
    });
  }
  server.removeAllListeners('request');

  const resolveScope = (req, url, claimedActor = undefined) => {
    const storeFor = (actor) => {
      const workspaceId = getUser(actor)?.workspaceId || actor;
      return workspaceId === 'demo-user'
        ? server.workspace.store
        : server.workspace.storeFor(workspaceId);
    };
    return createRequestScope({ req, url, secret, requireAuth, storeFor, claimedActor });
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

  // Build trie router and register all resource routes
  const router = new TrieRouter();
  const ctx = { resolveScope, begin, actionGuard, actorError, users, billingDeliveryAdapter, resolvedSmtpAdapter, billingDocumentValidator };
  registerInvoices(router, ctx);
  registerCustomers(router, ctx);
  registerProducts(router, ctx);
  registerRecurring(router, ctx);
  registerReports(router, ctx);
  registerSettings(router, ctx);

  // Non-routed endpoints that stay inline (dashboard, query, root, sync, actuals, audit)
  const handleInline = async (req, res, url) => {
    // GET /api/v1/billing — root billing state
    if (url.pathname === '/api/v1/billing' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      sendJson(res, 200, { version: API_VERSION, billing: projectBillingState(store.snapshot().billing) });
      return true;
    }

    // GET /api/v1/billing/dashboard
    if (url.pathname === '/api/v1/billing/dashboard' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const billing = store.snapshot().billing || {};
      const invoices = billing.invoices || [];
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      let totalOutstandingMinor = 0; let overdueCount = 0; let monthlyRevenueMinor = 0;
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
            invoiceId: invoice.id, invoiceNumber: invoice.number || null,
            customerName: (billing.customers || []).find(c => c.id === invoice.customerId)?.name || null,
            amountMinor: payment.amountMinor, paidAt: payment.paidAt, method: payment.method || null,
          });
        }
      }
      recentPayments.sort((a, b) => (b.paidAt || '').localeCompare(a.paidAt || ''));
      sendJson(res, 200, {
        version: API_VERSION,
        dashboard: { totalOutstandingMinor, overdueCount, monthlyRevenueMinor, currency: billing.settings?.currency || 'DKK', recentPayments: recentPayments.slice(0, 10), generatedAt: now.toISOString() },
      });
      return true;
    }

    // GET /api/v1/billing/query
    if (url.pathname === '/api/v1/billing/query' && req.method === 'GET') {
      const { actor, store } = await resolveScope(req, url);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
      catch { throw actorError('forbidden', 403); }
      const billing = store.snapshot().billing || {};
      const params = Object.fromEntries(url.searchParams.entries());
      const result = queryBilling(billing, params);
      sendJson(res, 200, { version: API_VERSION, ...result });
      return true;
    }

    // POST /api/v1/billing/sync
    if (url.pathname === '/api/v1/billing/sync' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body?.actor) throw actorError('actor_required', 422);
      const { actor, store } = await resolveScope(req, url, body.actor);
      const actionKey = begin(req, body, actor, store, '/api/v1/billing/sync', 'billing.sync');
      try {
        let sync;
        const next = await store.mutate((draft) => {
          const result = syncBillingSource(draft.billing, { schema: body.schema, source: body.source, customers: body.customers, visits: body.visits });
          draft.billing = result.billing;
          sync = { sourceId: body.source.id, revision: body.source.revision, ...result.summary };
          return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', sourceId: sync.sourceId, revision: sync.revision });
        sendJson(res, 200, { version: API_VERSION, sync, billing: projectBillingState(next.billing) });
      } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
      return true;
    }

    // POST /api/v1/billing/actuals
    if (url.pathname === '/api/v1/billing/actuals' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body?.actor) throw actorError('actor_required', 422);
      const { actor, store } = await resolveScope(req, url, body.actor);
      const actionKey = begin(req, body, actor, store, '/api/v1/billing/actuals', 'billing.manage');
      try {
        let visit;
        const next = await store.mutate((draft) => {
          const result = recordBillingActual(draft.billing, { visitId: body.visitId, actual: body.actual });
          draft.billing = result.billing; visit = result.visit; return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', visitId: visit.id });
        sendJson(res, 200, { version: API_VERSION, visit, billing: projectBillingState(next.billing) });
      } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
      return true;
    }

    // POST /api/v1/billing/actuals/correct
    if (url.pathname === '/api/v1/billing/actuals/correct' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body?.actor) throw actorError('actor_required', 422);
      const { actor, store } = await resolveScope(req, url, body.actor);
      const actionKey = begin(req, body, actor, store, '/api/v1/billing/actuals/correct', 'billing.actuals.correct');
      try {
        let visit;
        const next = await store.mutate((draft) => {
          const result = correctBillingActual(draft.billing, {
            visitId: body.visitId, actual: body.actual, actor, reason: body.reason,
            correctionId: actionKey, correctedAt: body.correctedAt,
          });
          draft.billing = result.billing; visit = result.visit; return draft;
        });
        actionGuard.complete(actionKey, { status: 'accepted', visitId: visit.id, corrected: true });
        sendJson(res, 200, { version: API_VERSION, visit, billing: projectBillingState(next.billing) });
      } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
      return true;
    }

    // POST /api/v1/billing/audit
    if (url.pathname === '/api/v1/billing/audit' && req.method === 'POST') {
      const body = await readJson(req);
      if (!body?.actor) throw actorError('actor_required', 422);
      const { actor, store } = await resolveScope(req, url, body.actor);
      try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.manage', users }); }
      catch { throw actorError('forbidden', 403); }
      const entry = {
        actor, action: body.action || 'unknown', timestamp: new Date().toISOString(),
        details: body.details || {}, invoiceId: body.invoiceId || null, invoiceNumber: body.invoiceNumber || null,
      };
      await store.mutate((draft) => {
        if (!draft.billing) draft.billing = {};
        if (!Array.isArray(draft.billing.auditLog)) draft.billing.auditLog = [];
        draft.billing.auditLog.push(entry);
        // Time-based pruning: remove entries older than 90 days
        const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        draft.billing.auditLog = draft.billing.auditLog.filter((e) => e.timestamp >= cutoff);
        // Bounded memory: keep last 1000 entries max
        if (draft.billing.auditLog.length > 1000) draft.billing.auditLog = draft.billing.auditLog.slice(-1000);
        return draft;
      });
      sendJson(res, 200, { ok: true });
      return true;
    }

    return false;
  };

  server.on('request', async (req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    // Apply request-id middleware
    requestIdMiddleware(req, res, () => {});

    // Try inline handlers first (dashboard, query, sync, actuals, audit, root)
    try {
      if (await handleInline(req, res, url)) return;
    } catch (error) { apiError(res, error); return; }

    // Try trie router
    const match = router.find(req.method, url.pathname);
    if (match) {
      try { await match.handler(req, res, match.params); }
      catch (error) { apiError(res, error); }
      return;
    }

    // Not a billing path — delegate to original listeners
    for (const listener of originals) listener.call(server, req, res);
  });

  // Recurring scheduler auto-tick
  let schedulerTimer = null;
  let schedulerRunning = false;
  const SCHEDULER_INTERVAL_MS = Number.parseInt(process.env.BILLING_SCHEDULER_INTERVAL_MS || '60000', 10);
  if (SCHEDULER_INTERVAL_MS > 0 && !process.env.BILLING_SCHEDULER_DISABLED) {
    schedulerTimer = setInterval(async () => {
      if (schedulerRunning) return;
      schedulerRunning = true;
      try {
        const tenantStores = server.workspace?.stores;
        if (!tenantStores || typeof tenantStores.forEach !== 'function') return;
        for (const [, entry] of tenantStores) {
          try {
            await entry.mutate((draft) => {
              const result = tickRecurringScheduler(draft.billing, { actor: 'scheduler' });
              draft.billing = result.billing; return draft;
            });
          } catch (err) { console.error('[scheduler] auto-tick failed for tenant store:', err?.message || err); }
        }
      } finally { schedulerRunning = false; }
    }, SCHEDULER_INTERVAL_MS);
    if (schedulerTimer.unref) schedulerTimer.unref();
  }

  const originalClose = server.close.bind(server);
  server.close = (callback) => {
    if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
    return originalClose(callback);
  };

  return server;
}
