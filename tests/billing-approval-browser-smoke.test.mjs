import test from 'node:test';
import assert from 'node:assert/strict';
import { createBillingClient } from '../src/billing/browser-client.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('browser client: approval methods send correct endpoints and payloads', async () => {
  const calls = [];
  const client = createBillingClient({
    actor: 'operator-1',
    token: 'studio-token',
    fetchFn: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.includes('/request-approval')) return jsonResponse({ invoice: { id: 'inv-1', status: 'pending_approval', approval: { requestedBy: 'operator-1' } } });
      if (url.includes('/approve')) return jsonResponse({ invoice: { id: 'inv-1', status: 'issued', approval: { approvedBy: 'operator-1' } } });
      if (url.includes('/reject-approval')) return jsonResponse({ invoice: { id: 'inv-1', status: 'draft', approval: { rejectedBy: 'operator-1', rejectionReason: 'Fejl' } } });
      return jsonResponse({ invoice: { id: 'inv-1', status: 'draft' } });
    },
  });

  // requestApproval
  const reqResult = await client.requestApproval('inv-1');
  assert.equal(reqResult.invoice.status, 'pending_approval');
  const reqCall = calls.find((c) => c.url.includes('/request-approval'));
  assert.ok(reqCall, 'requestApproval must call /request-approval endpoint');
  assert.equal(reqCall.options.method, 'POST');
  const reqBody = JSON.parse(reqCall.options.body);
  assert.equal(reqBody.actor, 'operator-1');
  assert.ok(reqBody.idempotencyKey);

  // approveInvoice
  const appResult = await client.approveInvoice('inv-1');
  assert.equal(appResult.invoice.status, 'issued');
  const appCall = calls.find((c) => c.url.includes('/approve') && !c.url.includes('reject'));
  assert.ok(appCall, 'approveInvoice must call /approve endpoint');
  assert.equal(appCall.options.method, 'POST');

  // rejectApproval
  const rejResult = await client.rejectApproval('inv-1', 'Fejl');
  assert.equal(rejResult.invoice.status, 'draft');
  assert.equal(rejResult.invoice.approval.rejectionReason, 'Fejl');
  const rejCall = calls.find((c) => c.url.includes('/reject-approval'));
  assert.ok(rejCall, 'rejectApproval must call /reject-approval endpoint');
  const rejBody = JSON.parse(rejCall.options.body);
  assert.equal(rejBody.reason, 'Fejl');
});

test('browser client: issueInvoice after approval sends correct request', async () => {
  let issueCall;
  const client = createBillingClient({
    actor: 'operator-1',
    token: 'studio-token',
    fetchFn: async (url, options = {}) => {
      if (url.includes('/issue')) {
        issueCall = { url, options };
        return jsonResponse({ invoice: { id: 'inv-2', status: 'issued', issuedBy: 'operator-1' } });
      }
      return jsonResponse({ invoice: { id: 'inv-2', status: 'draft' } });
    },
  });

  const result = await client.issueInvoice('inv-2');
  assert.equal(result.invoice.status, 'issued');
  assert.ok(issueCall, 'issueInvoice must call /issue endpoint');
  assert.equal(issueCall.options.method, 'POST');
  assert.match(issueCall.url, /\/invoices\/inv-2\/issue$/);
  const body = JSON.parse(issueCall.options.body);
  assert.equal(body.actor, 'operator-1');
  assert.ok(body.idempotencyKey);
});

test('browser client: recurring CRUD methods hit correct endpoints', async () => {
  const calls = [];
  const client = createBillingClient({
    actor: 'operator-1',
    token: 'studio-token',
    fetchFn: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === 'DELETE') return jsonResponse({ billing: {} });
      if (options.method === 'PATCH') return jsonResponse({ recurring: { id: 'rec-1', active: false } });
      if (url.endsWith('/recurring') && options.method === 'POST') {
        return jsonResponse({ recurring: { id: 'rec-1', customerId: 'cust-1' } }, 201);
      }
      return jsonResponse({ recurringInvoices: [] });
    },
  });

  await client.createRecurring({
    customerId: 'cust-1',
    productLines: [{ description: 'Test', quantity: 1, unitPriceMinor: 1000 }],
    schedule: { interval: { value: 1, unit: 'month' } },
  });
  const createCall = calls.find((c) => c.url.endsWith('/recurring') && c.options.method === 'POST');
  assert.ok(createCall);

  await client.updateRecurring('rec-1', { active: false });
  const updateCall = calls.find((c) => c.url.includes('/recurring/rec-1') && c.options.method === 'PATCH');
  assert.ok(updateCall);

  await client.deleteRecurring('rec-1');
  const deleteCall = calls.find((c) => c.url.includes('/recurring/rec-1') && c.options.method === 'DELETE');
  assert.ok(deleteCall);
});
