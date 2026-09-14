import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createAppServer } from '../server.mjs';
import {
  remindBillingInvoice,
  createBillingDraft,
  issueBillingInvoice,
  voidBillingInvoice,
} from '../src/billing/mutations.mjs';
import { billingFixtureState } from '../src/billing/fixtures.mjs';

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return `http://127.0.0.1:${server.address().port}`;
}

async function withBillingServer(fn, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'billing-reminder-'));
  const server = createAppServer({
    root: new URL('../', import.meta.url),
    stateFile: path.join(dir, 'state.json'),
    runtimeIntervalMs: 20,
    ...options,
  });
  const base = await listen(server);
  try {
    await fn({ base, dir, server });
  } finally {
    server.close();
    await once(server, 'close');
    await rm(dir, { recursive: true, force: true });
  }
}

async function req(base, urlPath, options = {}) {
  const response = await fetch(`${base}${urlPath}`, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { response, body };
}

function writeHeaders(idempotencyKey) {
  return {
    'content-type': 'application/json',
    'idempotency-key': idempotencyKey,
  };
}

test('remindBillingInvoice generates Danish reminder content for issued invoice', () => {
  const billing = billingFixtureState();
  const customer = billing.customers[0];
  assert.ok(customer, 'fixture must have at least one customer');

  const eligibleVisits = billing.visits.filter(
    (v) => v.customerId === customer.id && v.status === 'completed' && v.actual,
  );
  if (!eligibleVisits.length) return;

  const draftResult = createBillingDraft(billing, {
    customerId: customer.id,
    visitIds: [eligibleVisits[0].id],
    issueDate: '2026-08-01',
    actor: 'test-agent',
  });
  const issuedResult = issueBillingInvoice(draftResult.billing, {
    invoiceId: draftResult.invoice.id,
    actor: 'test-agent',
  });

  const result = remindBillingInvoice(issuedResult.billing, {
    invoiceId: issuedResult.invoice.id,
    actor: 'test-agent',
  });

  assert.ok(result.reminder, 'reminder must be generated');
  assert.ok(result.reminder.id.startsWith('reminder-'), 'reminder id format');
  assert.equal(result.reminder.invoiceId, issuedResult.invoice.id);
  assert.ok(result.reminder.subject.includes('Rykker'), 'subject must contain Rykker');
  assert.ok(result.reminder.body.includes('Kære'), 'body must use Danish greeting');
  assert.ok(
    result.reminder.body.includes('forfalden') || result.reminder.body.includes('påmindelse'),
    'body must reference due status',
  );
  assert.ok(result.reminder.generatedAt, 'must have timestamp');
  assert.equal(result.reminder.generatedBy, 'test-agent');

  const auditEntry = result.billing.auditLog.find(
    (e) => e.type === 'billing.invoice.reminder_generated',
  );
  assert.ok(auditEntry, 'audit log must contain reminder event');
  assert.equal(auditEntry.invoiceId, issuedResult.invoice.id);
});

test('remindBillingInvoice rejects draft invoices', () => {
  const billing = billingFixtureState();
  const customer = billing.customers[0];
  const eligibleVisits = billing.visits.filter(
    (v) => v.customerId === customer.id && v.status === 'completed' && v.actual,
  );
  if (!eligibleVisits.length) return;

  const draftResult = createBillingDraft(billing, {
    customerId: customer.id,
    visitIds: [eligibleVisits[0].id],
    issueDate: '2026-09-01',
    actor: 'test-agent',
  });

  assert.throws(
    () =>
      remindBillingInvoice(draftResult.billing, {
        invoiceId: draftResult.invoice.id,
        actor: 'test-agent',
      }),
    (err) => err.code === 'invoice_not_remindable',
  );
});

test('remindBillingInvoice rejects voided invoices', () => {
  const billing = billingFixtureState();
  const customer = billing.customers[0];
  const eligibleVisits = billing.visits.filter(
    (v) => v.customerId === customer.id && v.status === 'completed' && v.actual,
  );
  if (!eligibleVisits.length) return;

  let b = billing;
  const draft = createBillingDraft(b, {
    customerId: customer.id,
    visitIds: [eligibleVisits[0].id],
    issueDate: '2026-09-01',
    actor: 'test',
  });
  b = draft.billing;
  const issued = issueBillingInvoice(b, { invoiceId: draft.invoice.id, actor: 'test' });
  b = issued.billing;
  const voided = voidBillingInvoice(b, {
    invoiceId: draft.invoice.id,
    actor: 'test',
    reason: 'Test void',
  });

  assert.throws(
    () =>
      remindBillingInvoice(voided.billing, { invoiceId: draft.invoice.id, actor: 'test' }),
    (err) => err.code === 'invoice_voided',
  );
});

test('POST /api/v1/billing/invoices/:id/remind returns reminder via HTTP', async () => {
  await withBillingServer(async ({ base }) => {
    const cust = await req(base, '/api/v1/billing/customers', {
      method: 'POST',
      headers: writeHeaders('seed-cust-remind'),
      body: JSON.stringify({
        actor: 'demo-user',
        id: 'cust-remind',
        name: 'Reminder Test ApS',
        address: 'Testvej 1, 1000 København',
        countryCode: 'DK',
        billing: {
          mode: 'per_visit',
          rateMinor: 75000,
          currency: 'DKK',
          paymentTermsDays: 8,
        },
      }),
    });
    assert.equal(cust.response.status, 201);

    const draft = await req(base, '/api/v1/billing/invoices/manual-draft', {
      method: 'POST',
      headers: writeHeaders('manual-remind-1'),
      body: JSON.stringify({
        actor: 'demo-user',
        customerId: 'cust-remind',
        lines: [{ description: 'Test ydelse', quantity: 1, unitPriceMinor: 10000 }],
        number: 'REM-001',
        issueDate: '2026-08-01',
      }),
    });
    assert.equal(draft.response.status, 201);

    const issued = await req(
      base,
      `/api/v1/billing/invoices/${encodeURIComponent(draft.body.invoice.id)}/issue`,
      {
        method: 'POST',
        headers: writeHeaders('issue-remind-1'),
        body: JSON.stringify({ actor: 'demo-user' }),
      },
    );
    assert.equal(issued.response.status, 200);

    const reminder = await req(
      base,
      `/api/v1/billing/invoices/${encodeURIComponent(draft.body.invoice.id)}/remind`,
      {
        method: 'POST',
        headers: writeHeaders('remind-1'),
        body: JSON.stringify({ actor: 'demo-user' }),
      },
    );
    assert.equal(reminder.response.status, 201);
    assert.ok(reminder.body.reminder);
    assert.ok(reminder.body.reminder.subject.includes('Rykker'));
    assert.ok(reminder.body.reminder.body.includes('Kære'));
    assert.equal(reminder.body.reminder.generatedBy, 'demo-user');
    assert.ok(reminder.body.invoice.reminders.length >= 1);
  });
});

test('POST /api/v1/billing/invoices/:id/remind rejects non-existent invoice', async () => {
  await withBillingServer(async ({ base }) => {
    const { response, body } = await req(base, '/api/v1/billing/invoices/nonexistent/remind', {
      method: 'POST',
      headers: writeHeaders('remind-missing'),
      body: JSON.stringify({ actor: 'demo-user' }),
    });
    assert.equal(response.status, 404);
    assert.equal(body.error, 'invoice_not_found');
  });
});
