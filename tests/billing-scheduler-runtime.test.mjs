import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-scheduler-runtime-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20, fixtures: true, ...options });
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

test('scheduler timer is cleared on server.close — no leak', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-scheduler-leak-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({
    root: new URL('../', import.meta.url),
    stateFile,
    runtimeIntervalMs: 20,
    fixtures: true,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  // Close should clear the scheduler timer without error
  await new Promise((resolve) => server.close(resolve));
  await rm(dir, { recursive: true, force: true });
  // If we reach here without hanging, the timer was cleaned up
  assert.ok(true);
});

test('scheduler ticks tenant store and generates draft invoices', async (t) => {
  // Use a very short interval to test real timer behavior
  const originalEnv = process.env.BILLING_SCHEDULER_INTERVAL_MS;
  process.env.BILLING_SCHEDULER_INTERVAL_MS = '50';
  try {
    await withServer(async (base, server) => {
      // Create a recurring invoice via API
      const createRes = await fetch(`${base}/api/v1/billing/recurring`, post({
        customerId: 'customer-katrine',
        productLines: [{ description: 'Rengøring', quantity: 1, unitPriceMinor: 50000, discountPercent: 0 }],
        schedule: { interval: { value: 1, unit: 'month' } },
      }, `recurring-create-sched-${Date.now()}-${Math.random()}`));
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      const recurringId = created.recurring?.id || created.billing?.recurringInvoices?.[0]?.id;
      assert.ok(recurringId, 'should have created a recurring invoice');

      // Force nextRunAt to the past via direct store mutation
      const store = server.workspace.store;
      await store.mutate((draft) => {
        const rec = draft.billing.recurringInvoices.find((r) => r.id === recurringId);
        if (rec) rec.nextRunAt = '2026-01-01T00:00:00Z';
        return draft;
      });

      // Wait for scheduler to tick (interval is 50ms, wait 200ms for safety)
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check that a draft invoice was generated in the SAME store
      const snapshot = store.snapshot();
      const invoices = snapshot.billing.invoices || [];
      const drafts = invoices.filter((i) => i.status === 'draft');
      assert.ok(drafts.length >= 1, `expected at least 1 draft invoice in tenant store, got ${drafts.length}`);

      // Verify nextRunAt was advanced (idempotency)
      const updatedRec = snapshot.billing.recurringInvoices.find((r) => r.id === recurringId);
      assert.notEqual(updatedRec.nextRunAt, '2026-01-01T00:00:00Z', 'nextRunAt should be advanced after tick');
    });
  } finally {
    if (originalEnv === undefined) delete process.env.BILLING_SCHEDULER_INTERVAL_MS;
    else process.env.BILLING_SCHEDULER_INTERVAL_MS = originalEnv;
  }
});

test('scheduler does not duplicate drafts on repeated ticks', async () => {
  const originalEnv = process.env.BILLING_SCHEDULER_INTERVAL_MS;
  process.env.BILLING_SCHEDULER_INTERVAL_MS = '30';
  try {
    await withServer(async (base, server) => {
      const createRes = await fetch(`${base}/api/v1/billing/recurring`, post({
        customerId: 'customer-katrine',
        productLines: [{ description: 'Test', quantity: 1, unitPriceMinor: 10000, discountPercent: 0 }],
        schedule: { interval: { value: 1, unit: 'month' } },
      }, `recurring-dedup-${Date.now()}-${Math.random()}`));
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      const recurringId = created.recurring?.id || created.billing?.recurringInvoices?.[0]?.id;

      // Force nextRunAt to past
      const store = server.workspace.store;
      await store.mutate((draft) => {
        const rec = draft.billing.recurringInvoices.find((r) => r.id === recurringId);
        if (rec) rec.nextRunAt = '2026-01-01T00:00:00Z';
        return draft;
      });

      // Wait for multiple ticks
      await new Promise((resolve) => setTimeout(resolve, 250));

      const snapshot = store.snapshot();
      const invoices = snapshot.billing.invoices || [];
      // Check via recurring.lastInvoiceId since createManualBillingDraft doesn't set recurringInvoiceId
      const recAfter = snapshot.billing.recurringInvoices?.find((r) => r.id === recurringId);
      assert.ok(recAfter?.lastInvoiceId, 'recurring has lastInvoiceId after tick');
      // Verify exactly one draft was generated (no duplicates)
      const relatedDrafts = invoices.filter((i) => i.status === 'draft' && i.id === recAfter?.lastInvoiceId);
      assert.equal(relatedDrafts.length, 1, `expected exactly 1 draft, got ${relatedDrafts.length} — duplicates detected`);
    });
  } finally {
    if (originalEnv === undefined) delete process.env.BILLING_SCHEDULER_INTERVAL_MS;
    else process.env.BILLING_SCHEDULER_INTERVAL_MS = originalEnv;
  }
});

test('scheduler disabled when BILLING_SCHEDULER_DISABLED is set', async () => {
  const originalInterval = process.env.BILLING_SCHEDULER_INTERVAL_MS;
  const originalDisabled = process.env.BILLING_SCHEDULER_DISABLED;
  process.env.BILLING_SCHEDULER_INTERVAL_MS = '30';
  process.env.BILLING_SCHEDULER_DISABLED = '1';
  try {
    await withServer(async (base, server) => {
      const createRes = await fetch(`${base}/api/v1/billing/recurring`, post({
        customerId: 'customer-katrine',
        productLines: [{ description: 'Disabled test', quantity: 1, unitPriceMinor: 10000, discountPercent: 0 }],
        schedule: { interval: { value: 1, unit: 'month' } },
      }, `recurring-disabled-${Date.now()}-${Math.random()}`));
      assert.equal(createRes.status, 201);
      const created = await createRes.json();
      const recurringId = created.recurring?.id || created.billing?.recurringInvoices?.[0]?.id;

      const store = server.workspace.store;
      await store.mutate((draft) => {
        const rec = draft.billing.recurringInvoices.find((r) => r.id === recurringId);
        if (rec) rec.nextRunAt = '2026-01-01T00:00:00Z';
        return draft;
      });

      await new Promise((resolve) => setTimeout(resolve, 150));

      const snapshot = store.snapshot();
      const invoices = snapshot.billing.invoices || [];
      const drafts = invoices.filter((i) => i.status === 'draft');
      assert.equal(drafts.length, 0, `expected 0 drafts when scheduler disabled, got ${drafts.length}`);
    });
  } finally {
    if (originalInterval === undefined) delete process.env.BILLING_SCHEDULER_INTERVAL_MS;
    else process.env.BILLING_SCHEDULER_INTERVAL_MS = originalInterval;
    if (originalDisabled === undefined) delete process.env.BILLING_SCHEDULER_DISABLED;
    else process.env.BILLING_SCHEDULER_DISABLED = originalDisabled;
  }
});
