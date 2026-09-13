import { API_VERSION, readJson, sendJson } from './http-utils.mjs';
import { handleBillingDelivery } from './billing-delivery.mjs';
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
} from '../src/billing/mutations.mjs';

function apiError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 422;
  sendJson(res, status, { error: error?.code || 'billing_request_failed' });
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
    || pathname === '/api/v1/billing/invoices/manual-draft'
    || /^\/api\/v1\/billing\/invoices\/[^/]+\/(issue|artifact|document|peppol-bis3|deliver|void|payment|remind)$/.test(pathname)
    || /^\/api\/v1\/billing\/invoices\/[^/]+$/.test(pathname)
    || /^\/api\/v1\/billing\/customers\/[^/]+$/.test(pathname)
    || pathname === '/api/v1/billing/products'
    || /^\/api\/v1\/billing\/products\/[^/]+$/.test(pathname);
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
} = {}) {
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
        // Keep last 1000 entries to prevent unbounded growth
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

  return server;
}
