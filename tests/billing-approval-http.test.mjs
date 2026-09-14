import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-approval-http-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, fixtures: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base, server); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

function post(body, key) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ actor: 'demo-user', idempotencyKey: key, ...body }),
  };
}

function patch(body, key) {
  return {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ actor: 'demo-user', idempotencyKey: key, ...body }),
  };
}

test('HTTP: /issue blocks unapproved invoice when approval policy required', async () => {
  await withServer(async (base) => {
    // Enable approval policy
    const settingsRes = await fetch(`${base}/api/v1/billing/settings`, post({
      approvalPolicy: { required: true, allowSelfApproval: false },
    }, `settings-approval-${Date.now()}`));
    assert.equal(settingsRes.status, 200);

    // Create manual draft
    const draftRes = await fetch(`${base}/api/v1/billing/invoices/manual-draft`, post({
      customerId: 'customer-katrine',
      lines: [{ description: 'Test ydelse', quantity: 1, unitPriceMinor: 10000, discountPercent: 0 }],
      issueDate: '2026-09-14',
    }, `draft-approval-block-${Date.now()}`));
    assert.equal(draftRes.status, 201);
    const draft = await draftRes.json();
    const invoiceId = draft.invoice.id;

    // Attempt to issue without approval — must be rejected
    const issueRes = await fetch(`${base}/api/v1/billing/invoices/${invoiceId}/issue`, post({}, `issue-blocked-${Date.now()}`));
    assert.equal(issueRes.status, 422);
    const issueBody = await issueRes.json();
    assert.equal(issueBody.error, 'approval_required_before_issue');
  });
});

test('HTTP: full approval flow request → approve → issue succeeds', async () => {
  await withServer(async (base) => {
    // Enable approval policy
    await fetch(`${base}/api/v1/billing/settings`, post({
      approvalPolicy: { required: true, allowSelfApproval: true },
    }, `settings-flow-${Date.now()}`));

    // Create draft
    const draftRes = await fetch(`${base}/api/v1/billing/invoices/manual-draft`, post({
      customerId: 'customer-katrine',
      lines: [{ description: 'Flow test', quantity: 1, unitPriceMinor: 5000, discountPercent: 0 }],
      issueDate: '2026-09-14',
    }, `draft-flow-${Date.now()}`));
    assert.equal(draftRes.status, 201);
    const invoiceId = (await draftRes.json()).invoice.id;

    // Request approval
    const reqRes = await fetch(`${base}/api/v1/billing/invoices/${invoiceId}/request-approval`, post({}, `req-approval-${Date.now()}`));
    assert.equal(reqRes.status, 200);
    const reqBody = await reqRes.json();
    assert.equal(reqBody.invoice.status, 'pending_approval');

    // Approve (self-approval allowed in this test)
    const appRes = await fetch(`${base}/api/v1/billing/invoices/${invoiceId}/approve`, post({}, `approve-${Date.now()}`));
    assert.equal(appRes.status, 200);
    const appBody = await appRes.json();
    assert.equal(appBody.invoice.status, 'issued');
    assert.ok(appBody.invoice.approval?.approvedBy);
  });
});

test('HTTP: reject-approval returns invoice to draft with reason', async () => {
  await withServer(async (base) => {
    await fetch(`${base}/api/v1/billing/settings`, post({
      approvalPolicy: { required: true },
    }, `settings-reject-${Date.now()}`));

    const draftRes = await fetch(`${base}/api/v1/billing/invoices/manual-draft`, post({
      customerId: 'customer-katrine',
      lines: [{ description: 'Reject test', quantity: 1, unitPriceMinor: 8000, discountPercent: 0 }],
      issueDate: '2026-09-14',
    }, `draft-reject-${Date.now()}`));
    const invoiceId = (await draftRes.json()).invoice.id;

    await fetch(`${base}/api/v1/billing/invoices/${invoiceId}/request-approval`, post({}, `req-rej-${Date.now()}`));

    const rejRes = await fetch(`${base}/api/v1/billing/invoices/${invoiceId}/reject-approval`, post({
      reason: 'Mangler specifikation',
    }, `reject-${Date.now()}`));
    assert.equal(rejRes.status, 200);
    const rejBody = await rejRes.json();
    assert.equal(rejBody.invoice.status, 'draft');
    assert.equal(rejBody.invoice.approval.rejectionReason, 'Mangler specifikation');
  });
});

test('HTTP: editing pending_approval draft invalidates approval and reverts to draft', async () => {
  await withServer(async (base) => {
    await fetch(`${base}/api/v1/billing/settings`, post({
      approvalPolicy: { required: true },
    }, `settings-edit-invalidate-${Date.now()}`));

    const draftRes = await fetch(`${base}/api/v1/billing/invoices/manual-draft`, post({
      customerId: 'customer-katrine',
      lines: [{ description: 'Edit invalidate', quantity: 1, unitPriceMinor: 7000, discountPercent: 0 }],
      issueDate: '2026-09-14',
    }, `draft-edit-inv-${Date.now()}`));
    const invoiceId = (await draftRes.json()).invoice.id;

    await fetch(`${base}/api/v1/billing/invoices/${invoiceId}/request-approval`, post({}, `req-edit-${Date.now()}`));

    // Edit the draft while pending_approval
    const editRes = await fetch(`${base}/api/v1/billing/invoices/${invoiceId}`, patch({
      lines: [{ description: 'Opdateret', quantity: 2, unitPriceMinor: 7000, discountPercent: 0 }],
    }, `edit-pending-${Date.now()}`));
    assert.equal(editRes.status, 200);
    const editBody = await editRes.json();
    assert.equal(editBody.invoice.status, 'draft');
    assert.equal(editBody.invoice.approval, undefined);
  });
});

test('HTTP: recurring scheduler tick via POST generates only draft invoices', async () => {
  await withServer(async (base, server) => {
    // Create recurring invoice
    const createRes = await fetch(`${base}/api/v1/billing/recurring`, post({
      customerId: 'customer-katrine',
      productLines: [{ description: 'Scheduler HTTP test', quantity: 1, unitPriceMinor: 15000, discountPercent: 0 }],
      schedule: { interval: { value: 1, unit: 'month' } },
    }, `recurring-http-tick-${Date.now()}`));
    assert.equal(createRes.status, 201);
    const recurringId = (await createRes.json()).recurring.id;

    // Force nextRunAt to past
    const store = server.workspace.store;
    await store.mutate((draft) => {
      const rec = draft.billing.recurringInvoices.find((r) => r.id === recurringId);
      if (rec) rec.nextRunAt = '2026-01-01T00:00:00Z';
      return draft;
    });

    // Tick via HTTP
    const tickRes = await fetch(`${base}/api/v1/billing/recurring/tick`, post({
      now: new Date().toISOString(),
    }, `tick-http-${Date.now()}`));
    assert.equal(tickRes.status, 200);
    const tickBody = await tickRes.json();
    assert.equal(tickBody.generated.length, 1);

    // Verify generated invoice is a DRAFT (not issued)
    const snapshot = store.snapshot();
    const invoice = snapshot.billing.invoices.find((i) => i.id === tickBody.generated[0].invoiceId);
    assert.ok(invoice, 'generated invoice must exist in store');
    assert.equal(invoice.status, 'draft', 'scheduler-generated invoice must be draft, not issued');
  });
});

test('HTTP: recurring PATCH does not double-register idempotency key', async () => {
  await withServer(async (base) => {
    const createRes = await fetch(`${base}/api/v1/billing/recurring`, post({
      customerId: 'customer-katrine',
      productLines: [{ description: 'Patch test', quantity: 1, unitPriceMinor: 12000, discountPercent: 0 }],
      schedule: { interval: { value: 1, unit: 'month' } },
    }, `recurring-patch-dedup-${Date.now()}`));
    assert.equal(createRes.status, 201);
    const recurringId = (await createRes.json()).recurring.id;

    // PATCH should succeed without idempotency conflict
    const patchRes = await fetch(`${base}/api/v1/billing/recurring/${recurringId}`, patch({
      active: false,
    }, `recurring-patch-${Date.now()}`));
    assert.equal(patchRes.status, 200);
    const patchBody = await patchRes.json();
    assert.equal(patchBody.recurring.active, false);

    // Second PATCH with same key should be idempotent (not 409 conflict from double registration)
    const patchRes2 = await fetch(`${base}/api/v1/billing/recurring/${recurringId}`, patch({
      active: true,
    }, `recurring-patch-${Date.now()}-2`));
    assert.equal(patchRes2.status, 200);
  });
});

test('HTTP: recurring DELETE works without shadowed actionKey bug', async () => {
  await withServer(async (base) => {
    const createRes = await fetch(`${base}/api/v1/billing/recurring`, post({
      customerId: 'customer-katrine',
      productLines: [{ description: 'Delete test', quantity: 1, unitPriceMinor: 9000, discountPercent: 0 }],
      schedule: { interval: { value: 1, unit: 'month' } },
    }, `recurring-delete-${Date.now()}`));
    assert.equal(createRes.status, 201);
    const recurringId = (await createRes.json()).recurring.id;

    const delRes = await fetch(`${base}/api/v1/billing/recurring/${recurringId}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', 'idempotency-key': `del-recurring-${Date.now()}` },
      body: JSON.stringify({ actor: 'demo-user', idempotencyKey: `del-recurring-${Date.now()}` }),
    });
    assert.equal(delRes.status, 200);

    // Verify it's gone
    const listRes = await fetch(`${base}/api/v1/billing/recurring?actor=demo-user`);
    const listBody = await listRes.json();
    const found = listBody.recurringInvoices.find((r) => r.id === recurringId);
    assert.equal(found, undefined, 'deleted recurring should not appear in list');
  });
});
