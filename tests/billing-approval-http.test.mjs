import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { createUser, updateCapabilities, getUser } from '../src/user/user-store.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-billing-approval-http-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20, fixtures: true });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); }
  finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(dir, { recursive: true, force: true });
  }
}

const APPROVER_ID = 'approver-alice';
const REQUESTER_ID = 'requester-bob';
const LIMITED_ID = 'limited-carol';

function ensureUser(id, name, role, capabilities, workspaceId) {
  const existing = getUser(id);
  if (existing) {
    try { updateCapabilities(id, capabilities); } catch { /* ignore */ }
  } else {
    createUser({ id, name, role, capabilities, workspaceId });
  }
}

const SHARED_WORKSPACE = 'billing-approval-test-ws';

function setupUsers() {
  ensureUser(APPROVER_ID, 'Alice Approver', 'operator', ['billing.read', 'billing.manage', 'billing.approve'], SHARED_WORKSPACE);
  ensureUser(REQUESTER_ID, 'Bob Requester', 'operator', ['billing.read', 'billing.manage'], SHARED_WORKSPACE);
  ensureUser(LIMITED_ID, 'Carol Limited', 'member', ['billing.read'], SHARED_WORKSPACE);
  ensureUser('demo-user', 'Demo User', 'operator', ['billing.read', 'billing.manage', 'billing.approve'], 'demo-user');
}

// Global setup — run once before all tests
setupUsers();

let keyCounter = 0;
function uniqueKey(prefix) {
  keyCounter += 1;
  return `${prefix}-${process.pid}-${Date.now()}-${keyCounter}-${Math.random().toString(36).slice(2)}`;
}

async function postJson(base, urlPath, actor, body, idempotencyKey) {
  return fetch(`${base}${urlPath}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey || uniqueKey(actor),
    },
    body: JSON.stringify({ actor, ...body }),
  });
}

async function patchJson(base, urlPath, actor, body, idempotencyKey) {
  return fetch(`${base}${urlPath}`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'idempotency-key': idempotencyKey || uniqueKey(actor),
    },
    body: JSON.stringify({ actor, ...body }),
  });
}

async function createDraft(base, actor) {
  const res = await postJson(base, '/api/v1/billing/invoices/manual-draft', actor, {
    customerId: 'customer-katrine',
    lines: [{ description: 'Approval Test Service', quantity: 1, unitPriceMinor: 50000, taxRate: 0.25 }],
    issueDate: '2026-09-14',
  });
  assert.equal(res.status, 201, `draft creation should succeed, got ${res.status}`);
  const body = await res.json();
  return body.invoice;
}

test('approval HTTP: request-approval requires billing.manage capability', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    const res = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, LIMITED_ID, {});
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'forbidden');
  });
});

test('approval HTTP: request-approval transitions draft to pending_approval', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    const res = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, REQUESTER_ID, {});
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.invoice.status, 'pending_approval');
    assert.equal(body.invoice.approval.requestedBy, REQUESTER_ID);
    assert.ok(body.invoice.approval.requestedAt);
  });
});

test('approval HTTP: approve requires billing.approve capability', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, REQUESTER_ID, {});
    const res = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/approve`, REQUESTER_ID, {});
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'forbidden');
  });
});

test('approval HTTP: approve transitions pending_approval to issued with distinct approver', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, REQUESTER_ID, {});
    const res = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/approve`, APPROVER_ID, {});
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.invoice.status, 'issued');
    assert.equal(body.invoice.approval.approvedBy, APPROVER_ID);
    assert.equal(body.invoice.issuedBy, APPROVER_ID);
    assert.ok(body.invoice.issuedAt);
  });
});

test('approval HTTP: self-approval forbidden when policy disallows', async () => {
  await withServer(async (base) => {
    // Enable approval policy with self-approval disabled within same server scope
    const settingsRes = await postJson(base, '/api/v1/billing/settings', APPROVER_ID, {
      approvalPolicy: { required: true, allowSelfApproval: false },
    });
    assert.equal(settingsRes.status, 200);

    const invoice = await createDraft(base, APPROVER_ID);
    await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, APPROVER_ID, {});
    const res = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/approve`, APPROVER_ID, {});
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error, 'self_approval_forbidden');
  });
});

test('approval HTTP: reject-approval returns to draft with reason', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, REQUESTER_ID, {});
    const res = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/reject-approval`, APPROVER_ID, {
      reason: 'Mangler specifikation',
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.invoice.status, 'draft');
    assert.equal(body.invoice.approval.rejectedBy, APPROVER_ID);
    assert.equal(body.invoice.approval.rejectionReason, 'Mangler specifikation');
  });
});

test('approval HTTP: editing pending_approval draft invalidates approval and reverts to draft', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, REQUESTER_ID, {});
    const editRes = await patchJson(base, `/api/v1/billing/invoices/${invoice.id}`, REQUESTER_ID, {
      lines: [{ description: 'Updated Service', quantity: 2, unitPriceMinor: 50000, taxRate: 0.25 }],
    });
    assert.equal(editRes.status, 200);
    const edited = await editRes.json();
    assert.equal(edited.invoice.status, 'draft');
    assert.equal(edited.invoice.approval, undefined);
  });
});

test('approval HTTP: issue blocked when approval policy required and status is draft', async () => {
  await withServer(async (base) => {
    // Enable required approval policy within same server scope
    const settingsRes = await postJson(base, '/api/v1/billing/settings', APPROVER_ID, {
      approvalPolicy: { required: true },
    });
    assert.equal(settingsRes.status, 200);

    const invoice = await createDraft(base, REQUESTER_ID);
    const res = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/issue`, REQUESTER_ID, {});
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'approval_required_before_issue');
  });
});

test('approval HTTP: idempotency enforced on request-approval', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    const key = uniqueKey('idem-req');
    const first = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, REQUESTER_ID, {}, key);
    assert.equal(first.status, 200);
    const second = await postJson(base, `/api/v1/billing/invoices/${invoice.id}/request-approval`, REQUESTER_ID, {}, key);
    assert.equal(second.status, 409);
    const body = await second.json();
    assert.equal(body.error, 'idempotency_conflict');
  });
});

test('approval HTTP: missing idempotency key returns 422', async () => {
  await withServer(async (base) => {
    const invoice = await createDraft(base, REQUESTER_ID);
    const res = await fetch(`${base}/api/v1/billing/invoices/${invoice.id}/request-approval`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: REQUESTER_ID }),
    });
    assert.equal(res.status, 422);
    const body = await res.json();
    assert.equal(body.error, 'idempotency_key_required');
  });
});

test('approval HTTP: settings roundtrip persists approvalPolicy', async () => {
  await withServer(async (base) => {
    const setRes = await postJson(base, '/api/v1/billing/settings', APPROVER_ID, {
      approvalPolicy: { required: true, allowSelfApproval: false },
    });
    assert.equal(setRes.status, 200);
    const getRes = await fetch(`${base}/api/v1/billing?actor=${APPROVER_ID}`);
    assert.equal(getRes.status, 200);
    const state = await getRes.json();
    assert.equal(state.billing.settings.approvalPolicy.required, true);
    assert.equal(state.billing.settings.approvalPolicy.allowSelfApproval, false);
  });
});
