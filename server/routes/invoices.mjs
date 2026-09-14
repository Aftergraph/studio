/**
 * Invoice routes: /api/v1/billing/invoices/*
 */
import { API_VERSION, readJson, sendJson } from '../http-utils.mjs';
import { handleBillingDelivery } from '../billing-delivery.mjs';
import { composeInvoiceEmail } from '../billing-email-adapter.mjs';
import { assertActorCapability } from '../../src/action-guard.mjs';
import { renderInvoicePdf } from '../../src/billing/artifact.mjs';
import { DOCUMENT_PROFILES, buildInvoiceDocument, validateInvoiceDocument } from '../../src/billing/document-profile.mjs';
import { renderPeppolBis3Ubl } from '../../src/billing/peppol-bis3.mjs';
import { evaluateBilling } from '../../src/billing/readiness.mjs';
import {
  createBillingDraft,
  createManualBillingDraft,
  updateManualBillingDraft,
  issueBillingInvoice,
  voidBillingInvoice,
  recordBillingPayment,
  remindBillingInvoice,
  requestBillingApproval,
  approveBillingInvoice,
  rejectBillingApproval,
} from '../../src/billing/mutations.mjs';

function projectBillingState(billing) {
  return { ...billing, projection: evaluateBilling({ ...billing, now: new Date().toISOString() }) };
}

export function register(router, ctx) {
  const { resolveScope, begin, actionGuard, actorError, users, billingDeliveryAdapter, resolvedSmtpAdapter, billingDocumentValidator } = ctx;

  router.add('POST', '/api/v1/billing/invoices/draft', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, '/api/v1/billing/invoices/draft', 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = createBillingDraft(draft.billing, {
          customerId: body.customerId, visitIds: body.visitIds, number: body.number, issueDate: body.issueDate, actor,
        });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
      sendJson(res, 201, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/invoices/manual-draft', async (req, res) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const actionKey = begin(req, body, actor, store, '/api/v1/billing/invoices/manual-draft', 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = createManualBillingDraft(draft.billing, {
          customerId: body.customerId, lines: body.lines, number: body.number, issueDate: body.issueDate, actor,
        });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
      sendJson(res, 201, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('PATCH', '/api/v1/billing/invoices/:invoiceId', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}`, 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = updateManualBillingDraft(draft.billing, { invoiceId, lines: body.lines, issueDate: body.issueDate, actor });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
      sendJson(res, 200, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('GET', '/api/v1/billing/invoices/:invoiceId/artifact', async (req, res, params) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
    catch { throw actorError('forbidden', 403); }
    const artifact = renderInvoicePdf({ billing: store.snapshot().billing, invoiceId: params.invoiceId });
    res.statusCode = 200;
    res.setHeader('content-type', artifact.contentType);
    res.setHeader('content-disposition', `attachment; filename="${artifact.filename}"`);
    res.setHeader('content-length', artifact.body.length);
    res.setHeader('cache-control', 'no-store');
    res.end(artifact.body);
  });

  router.add('GET', '/api/v1/billing/invoices/:invoiceId/document', async (req, res, params) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
    catch { throw actorError('forbidden', 403); }
    const document = buildInvoiceDocument({ billing: store.snapshot().billing, invoiceId: params.invoiceId });
    sendJson(res, 200, { version: API_VERSION, document });
  });

  router.add('GET', '/api/v1/billing/invoices/:invoiceId/peppol-bis3', async (req, res, params) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
    catch { throw actorError('forbidden', 403); }
    const document = buildInvoiceDocument({ billing: store.snapshot().billing, invoiceId: params.invoiceId });
    const profile = 'peppol-bis-3.0-2026-05';
    const preflight = validateInvoiceDocument(document, { profile });
    if (!preflight.ok) { sendJson(res, 422, { error: 'document_profile_validation_failed', profile, errors: preflight.errors }); return; }
    const descriptor = DOCUMENT_PROFILES[profile];
    if (descriptor?.externalValidationRequired && typeof billingDocumentValidator !== 'function') { sendJson(res, 503, { error: 'document_validator_unavailable', profile }); return; }
    const xml = renderPeppolBis3Ubl(document);
    if (descriptor?.externalValidationRequired) {
      let external;
      try { external = await billingDocumentValidator({ profile, document, xml }); }
      catch { sendJson(res, 503, { error: 'document_validator_unavailable', profile }); return; }
      if (!external?.ok) { sendJson(res, 422, { error: 'document_external_validation_failed', profile, errors: external?.errors || ['external_validation_failed'] }); return; }
    }
    res.statusCode = 200;
    res.setHeader('content-type', 'application/xml; charset=utf-8');
    res.setHeader('cache-control', 'no-store');
    res.end(xml);
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/issue', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/issue`, 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = issueBillingInvoice(draft.billing, { invoiceId, actor });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
      sendJson(res, 200, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/request-approval', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.manage', users }); }
    catch { throw actorError('forbidden', 403); }
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/request-approval`, 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = requestBillingApproval(draft.billing, { invoiceId, actor });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
      sendJson(res, 200, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/approve', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.approve', users }); }
    catch { throw actorError('forbidden', 403); }
    const { getUser } = await import('../../src/user/user-store.mjs');
    const user = getUser(actor);
    const permissions = user?.capabilities || [];
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/approve`, 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = approveBillingInvoice(draft.billing, { invoiceId, actor, permissions });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
      sendJson(res, 200, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/reject-approval', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.approve', users }); }
    catch { throw actorError('forbidden', 403); }
    const { getUser } = await import('../../src/user/user-store.mjs');
    const user = getUser(actor);
    const permissions = user?.capabilities || [];
    const reason = body?.reason || '';
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/reject-approval`, 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = rejectBillingApproval(draft.billing, { invoiceId, actor, reason, permissions });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id });
      sendJson(res, 200, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/email-preview', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    try { assertActorCapability({ state: store.snapshot(), actor, capability: 'billing.read', users }); }
    catch { throw actorError('forbidden', 403); }
    const snapshot = store.snapshot().billing;
    const invoiceId = params.invoiceId;
    const invoice = snapshot.invoices?.find((i) => i.id === invoiceId);
    if (!invoice) throw actorError('invoice_not_found', 404);
    const customer = snapshot.customers?.find((c) => c.id === invoice.customerId);
    const recipientEmail = invoice.customerSnapshot?.email || customer?.email || null;
    if (!recipientEmail) throw actorError('delivery_recipient_missing', 422);
    const issuer = invoice.issuerSnapshot || snapshot.settings?.issuer || {};
    const { subject, text, html } = composeInvoiceEmail({ invoice, customer, issuer });
    sendJson(res, 200, {
      version: API_VERSION,
      preview: { invoiceId, recipientEmail, subject, text, html, attachmentFilename: `invoice-${String(invoice.number || invoiceId).replace(/[^a-zA-Z0-9._-]/g, '-')}.pdf` },
    });
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/send-email', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    if (!resolvedSmtpAdapter?.name || typeof resolvedSmtpAdapter.deliver !== 'function') throw actorError('smtp_delivery_unavailable', 503);
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/send-email`, 'billing.manage');
    await handleBillingDelivery({ store, invoiceId, actor, adapter: resolvedSmtpAdapter, actionKey, actionGuard, res });
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/deliver', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    if (!billingDeliveryAdapter?.name || typeof billingDeliveryAdapter.deliver !== 'function') throw actorError('delivery_provider_unavailable', 503);
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/deliver`, 'billing.manage');
    await handleBillingDelivery({ store, invoiceId, actor, adapter: billingDeliveryAdapter, actionKey, actionGuard, res });
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/void', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/void`, 'billing.manage');
    try {
      let invoice;
      const next = await store.mutate((draft) => {
        const result = voidBillingInvoice(draft.billing, { invoiceId, actor, reason: body.reason });
        draft.billing = result.billing; invoice = result.invoice; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id, voided: true });
      sendJson(res, 200, { version: API_VERSION, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/payment', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/payment`, 'billing.manage');
    try {
      let invoice; let payment;
      const next = await store.mutate((draft) => {
        const result = recordBillingPayment(draft.billing, { invoiceId, amountMinor: body.amountMinor, method: body.method, reference: body.reference, paidAt: body.paidAt, actor });
        draft.billing = result.billing; invoice = result.invoice; payment = result.payment; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id, paymentId: payment.id });
      sendJson(res, 201, { version: API_VERSION, payment, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });

  router.add('POST', '/api/v1/billing/invoices/:invoiceId/remind', async (req, res, params) => {
    const body = await readJson(req);
    if (!body?.actor) throw actorError('actor_required', 422);
    const url = new URL(req.url, 'http://127.0.0.1');
    const { actor, store } = await resolveScope(req, url, body.actor);
    const invoiceId = params.invoiceId;
    const actionKey = begin(req, body, actor, store, `/api/v1/billing/invoices/${invoiceId}/remind`, 'billing.manage');
    try {
      let invoice; let reminder;
      const next = await store.mutate((draft) => {
        const result = remindBillingInvoice(draft.billing, { invoiceId, actor });
        draft.billing = result.billing; invoice = result.invoice; reminder = result.reminder; return draft;
      });
      actionGuard.complete(actionKey, { status: 'accepted', invoiceId: invoice.id, reminderId: reminder.id });
      sendJson(res, 201, { version: API_VERSION, reminder, invoice, billing: projectBillingState(next.billing) });
    } catch (error) { actionGuard.fail(actionKey, error?.message || error); throw error; }
  });
}
