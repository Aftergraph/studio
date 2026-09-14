import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createManualBillingDraft,
  issueBillingInvoice,
  updateManualBillingDraft,
  updateBillingSettings,
  requestBillingApproval,
  approveBillingInvoice,
  rejectBillingApproval,
} from '../../src/billing/mutations.mjs';

function baseBilling(settings = {}) {
  return {
    invoices: [],
    customers: [{ id: 'cust-1', name: 'Test Kunde', countryCode: 'DK', billing: { currency: 'DKK', paymentTermsDays: 8 } }],
    products: [],
    settings: { invoiceSequence: { nextNumber: 1 }, ...settings },
    auditLog: [],
  };
}

function makeDraft(billing, overrides = {}) {
  const result = createManualBillingDraft(billing, {
    customerId: 'cust-1',
    lines: [{ description: 'Ydelse', quantity: 1, unitPriceMinor: 10000, taxRate: 0.25 }],
    issueDate: '2026-09-14',
    actor: 'user-a',
    ...overrides,
  });
  return result;
}

test('approval gate: default policy preserves direct issue behavior', () => {
  let billing = baseBilling();
  const draft = makeDraft(billing);
  billing = draft.billing;
  const issued = issueBillingInvoice(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  assert.equal(issued.invoice.status, 'issued');
});

test('approval gate: when approvalRequired=true, issue from draft is rejected', () => {
  let billing = baseBilling({ approvalPolicy: { required: true } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  assert.throws(
    () => issueBillingInvoice(billing, { invoiceId: draft.invoice.id, actor: 'user-a' }),
    (err) => err.code === 'approval_required_before_issue'
  );
});

test('approval gate: requestApproval transitions draft to pending_approval', () => {
  let billing = baseBilling({ approvalPolicy: { required: true } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  const requested = requestBillingApproval(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  assert.equal(requested.invoice.status, 'pending_approval');
  assert.equal(requested.invoice.approval.requestedBy, 'user-a');
  assert.ok(requested.invoice.approval.requestedAt);
});

test('approval gate: approveInvoice transitions pending_approval to issued with approver distinct from requester', () => {
  let billing = baseBilling({ approvalPolicy: { required: true } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  const requested = requestBillingApproval(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  billing = requested.billing;
  const approved = approveBillingInvoice(billing, {
    invoiceId: draft.invoice.id,
    actor: 'user-b',
    permissions: ['billing.approve'],
  });
  assert.equal(approved.invoice.status, 'issued');
  assert.equal(approved.invoice.approval.approvedBy, 'user-b');
  assert.equal(approved.invoice.issuedBy, 'user-b');
});

test('approval gate: self-approval forbidden when policy disallows', () => {
  let billing = baseBilling({ approvalPolicy: { required: true, allowSelfApproval: false } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  const requested = requestBillingApproval(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  billing = requested.billing;
  assert.throws(
    () => approveBillingInvoice(billing, {
      invoiceId: draft.invoice.id,
      actor: 'user-a',
      permissions: ['billing.approve'],
    }),
    (err) => err.code === 'self_approval_forbidden'
  );
});

test('approval gate: missing billing.approve permission rejects approval', () => {
  let billing = baseBilling({ approvalPolicy: { required: true } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  const requested = requestBillingApproval(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  billing = requested.billing;
  assert.throws(
    () => approveBillingInvoice(billing, {
      invoiceId: draft.invoice.id,
      actor: 'user-b',
      permissions: [],
    }),
    (err) => err.code === 'permission_denied'
  );
});

test('approval gate: editing draft invalidates pending approval and reverts to draft', () => {
  let billing = baseBilling({ approvalPolicy: { required: true } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  const requested = requestBillingApproval(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  billing = requested.billing;
  // updateManualBillingDraft requires status=draft, so we first need to allow editing of pending_approval
  // or the mutation must handle invalidation. We'll implement that next.
  const updated = updateManualBillingDraft(billing, {
    invoiceId: draft.invoice.id,
    lines: [{ description: 'Opdateret ydelse', quantity: 2, unitPriceMinor: 10000, taxRate: 0.25 }],
    actor: 'user-a',
  });
  assert.equal(updated.invoice.status, 'draft');
  assert.equal(updated.invoice.approval, undefined);
  const lastAudit = updated.billing.auditLog.at(-1);
  assert.equal(lastAudit?.action, 'approval_invalidated_by_edit');
});

test('approval gate: rejectApproval returns to draft with reason', () => {
  let billing = baseBilling({ approvalPolicy: { required: true } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  const requested = requestBillingApproval(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  billing = requested.billing;
  const rejected = rejectBillingApproval(billing, {
    invoiceId: draft.invoice.id,
    actor: 'user-b',
    reason: 'Mangler specifikation',
    permissions: ['billing.approve'],
  });
  assert.equal(rejected.invoice.status, 'draft');
  assert.equal(rejected.invoice.approval.rejectedBy, 'user-b');
  assert.equal(rejected.invoice.approval.rejectionReason, 'Mangler specifikation');
});

test('approval gate: audit log records approval events', () => {
  let billing = baseBilling({ approvalPolicy: { required: true } });
  const draft = makeDraft(billing);
  billing = draft.billing;
  const requested = requestBillingApproval(billing, { invoiceId: draft.invoice.id, actor: 'user-a' });
  billing = requested.billing;
  const approved = approveBillingInvoice(billing, {
    invoiceId: draft.invoice.id,
    actor: 'user-b',
    permissions: ['billing.approve'],
  });
  const actions = approved.billing.auditLog.map((e) => e.action);
  assert.ok(actions.includes('approval_requested'));
  assert.ok(actions.includes('invoice_approved'));
});
