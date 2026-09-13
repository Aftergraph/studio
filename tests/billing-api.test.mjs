import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { issueMagicToken } from '../src/auth/magic-link.mjs';
import { createUser } from '../src/user/user-store.mjs';

async function withServer(fn, options = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-billing-api-'));
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

async function json(url, options) {
  const response = await fetch(url, options);
  return { response, body: await response.json() };
}

function post(body, key) {
  return postAs('demo-user', body, key);
}

function postAs(actor, body, key) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify({ actor, idempotencyKey: key, ...body }),
  };
}

test('GET /api/v1/billing returns canonical billing state and queue projection', async () => {
  await withServer(async (base) => {
    const { response, body } = await json(`${base}/api/v1/billing`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control') || '', /no-store/i);
    assert.equal(body.version, 'aftergraph.workspace.v5');
    assert.ok(Array.isArray(body.billing.customers));
    const statuses = new Map(body.billing.projection.items.map((item) => [item.customerName, item.status]));
    assert.equal(statuses.get('Katrine Rindom Andersen'), 'ready');
    assert.equal(statuses.get('Anton Horsbøl Skjeldmoes'), 'waiting');
    assert.equal(statuses.get('Peder Kjær'), 'needs_info');
  });
});

test('actuals mutation persists and turns a missing-evidence visit ready', async () => {
  await withServer(async (base) => {
    const write = await json(`${base}/api/v1/billing/actuals`, post({
      visitId: 'peder-2026-09-02',
      actual: {
        startedAt: '2026-09-02T08:30:00+02:00',
        endedAt: '2026-09-02T09:30:00+02:00',
        workers: 2,
        workMinutes: 120,
      },
    }, 'billing-actuals-1'));
    assert.equal(write.response.status, 200);
    assert.equal(write.body.visit.actual.workMinutes, 120);

    const read = await json(`${base}/api/v1/billing`);
    const peder = read.body.billing.projection.items.find((item) => item.customerName === 'Peder Kjær');
    assert.equal(peder.status, 'ready');
  });
});

test('actuals mutation rejects conflicting replacement after invoice issue', async () => {
  await withServer(async (base) => {
    const actual = {
      workMinutes: 120,
      workers: 2,
      startedAt: '2026-09-02T08:30:00+02:00',
      endedAt: '2026-09-02T09:30:00+02:00',
    };
    const first = await json(`${base}/api/v1/billing/actuals`, post({
      visitId: 'peder-2026-09-02',
      actual,
    }, 'billing-actuals-integrity-1'));
    assert.equal(first.response.status, 200);

    const replay = await json(`${base}/api/v1/billing/actuals`, post({
      visitId: 'peder-2026-09-02',
      actual,
    }, 'billing-actuals-integrity-replay'));
    assert.equal(replay.response.status, 200);
    assert.deepEqual(replay.body.visit.actual, actual);

    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-peder',
      visitIds: ['peder-2026-09-02'],
      number: '1380',
      issueDate: '2026-09-11',
    }, 'billing-actuals-integrity-draft'));
    assert.equal(draft.response.status, 201);

    const issued = await json(
      `${base}/api/v1/billing/invoices/${encodeURIComponent(draft.body.invoice.id)}/issue`,
      post({}, 'billing-actuals-integrity-issue'),
    );
    assert.equal(issued.response.status, 200);

    const conflict = await json(`${base}/api/v1/billing/actuals`, post({
      visitId: 'peder-2026-09-02',
      actual: { ...actual, workMinutes: 1 },
    }, 'billing-actuals-integrity-conflict'));
    assert.equal(conflict.response.status, 409);
    assert.equal(conflict.body.error, 'actuals_conflict');

    const read = await json(`${base}/api/v1/billing`);
    const visit = read.body.billing.visits.find((entry) => entry.id === 'peder-2026-09-02');
    assert.equal(visit.actual.workMinutes, 120);
  });
});

test('actual correction requires dedicated permission, reason and invoice-lock policy', async () => {
  const actor = `billing-corrector-${Date.now()}`;
  const limitedActor = `${actor}-limited`;
  createUser({ id: actor, name: actor, role: 'operator', capabilities: ['billing.manage', 'billing.actuals.correct'] });
  createUser({ id: limitedActor, name: limitedActor, role: 'operator', capabilities: ['billing.manage'] });

  await withServer(async (base) => {
    const recorded = await json(`${base}/api/v1/billing/actuals`, postAs(actor, {
      visitId: 'peder-2026-09-02',
      actual: { workMinutes: 120 },
    }, 'actual-correction-record'));
    assert.equal(recorded.response.status, 200);

    const denied = await json(`${base}/api/v1/billing/actuals/correct`, postAs(limitedActor, {
      visitId: 'peder-2026-09-02',
      actual: { workMinutes: 150 },
      reason: 'Correction requested',
    }, 'actual-correction-denied'));
    assert.equal(denied.response.status, 403);
    assert.equal(denied.body.error, 'forbidden');

    const corrected = await json(`${base}/api/v1/billing/actuals/correct`, postAs(actor, {
      visitId: 'peder-2026-09-02',
      actual: { workMinutes: 150 },
      reason: 'Operator corrected the recorded duration after customer confirmation',
    }, 'actual-correction-1'));
    assert.equal(corrected.response.status, 200);
    assert.equal(corrected.body.visit.actual.workMinutes, 150);
    const audit = corrected.body.billing.auditLog.at(-1);
    assert.equal(audit.type, 'billing.actuals.corrected');
    assert.equal(audit.actor, actor);
    assert.equal(audit.reason, 'Operator corrected the recorded duration after customer confirmation');
    assert.equal(audit.before.workMinutes, 120);
    assert.equal(audit.after.workMinutes, 150);

    const draft = await json(`${base}/api/v1/billing/invoices/draft`, postAs(actor, {
      customerId: 'customer-peder',
      visitIds: ['peder-2026-09-02'],
      issueDate: '2026-09-11',
    }, 'actual-correction-draft'));
    assert.equal(draft.response.status, 201);
    const issued = await json(
      `${base}/api/v1/billing/invoices/${encodeURIComponent(draft.body.invoice.id)}/issue`,
      postAs(actor, {}, 'actual-correction-issue'),
    );
    assert.equal(issued.response.status, 200);

    const locked = await json(`${base}/api/v1/billing/actuals/correct`, postAs(actor, {
      visitId: 'peder-2026-09-02',
      actual: { workMinutes: 180 },
      reason: 'Late correction after invoice issue',
    }, 'actual-correction-locked'));
    assert.equal(locked.response.status, 409);
    assert.equal(locked.body.error, 'actuals_locked');
  });
});

test('draft creation rejects a group whose billing window is still open', async () => {
  await withServer(async (base) => {
    const result = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-anton',
      visitIds: ['anton-2026-09-09'],
      number: '1371',
      issueDate: '2026-09-11',
    }, 'billing-draft-anton'));
    assert.equal(result.response.status, 422);
    assert.equal(result.body.error, 'billing_not_ready');
  });
});

test('ready group can create a deterministic draft with payment terms and duplicate protection', async () => {
  await withServer(async (base) => {
    const request = {
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      number: '1370',
      issueDate: '2026-09-11',
    };
    const created = await json(`${base}/api/v1/billing/invoices/draft`, post(request, 'billing-draft-katrine'));
    assert.equal(created.response.status, 201);
    assert.equal(created.body.invoice.status, 'draft');
    assert.equal(created.body.invoice.number, '1370');
    assert.equal(created.body.invoice.dueDate, '2026-09-19');
    assert.equal(created.body.invoice.totalGrossMinor, 453700);
    assert.deepEqual(created.body.invoice.visitIds, ['katrine-2026-09-07']);

    const duplicate = await json(`${base}/api/v1/billing/invoices/draft`, post(request, 'billing-draft-katrine-2'));
    assert.equal(duplicate.response.status, 422);
    assert.equal(duplicate.body.error, 'billing_not_ready');
  });
});

test('issue transition is guarded and stable when retried with a fresh request key', async () => {
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      number: '1370',
      issueDate: '2026-09-11',
    }, 'billing-draft-before-issue'));
    assert.equal(draft.response.status, 201);
    const id = draft.body.invoice.id;

    const issued = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'billing-issue-1'));
    assert.equal(issued.response.status, 200);
    assert.equal(issued.body.invoice.status, 'issued');

    const retried = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'billing-issue-2'));
    assert.equal(retried.response.status, 200);
    assert.equal(retried.body.invoice.status, 'issued');
  });
});

test('consequential billing writes require actor and idempotency key', async () => {
  await withServer(async (base) => {
    const missingActor = await json(`${base}/api/v1/billing/actuals`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'missing-actor' },
      body: JSON.stringify({ visitId: 'peder-2026-09-02', actual: { workMinutes: 120 } }),
    });
    assert.equal(missingActor.response.status, 422);

    const missingKey = await json(`${base}/api/v1/billing/actuals`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actor: 'demo-user', visitId: 'peder-2026-09-02', actual: { workMinutes: 120 } }),
    });
    assert.equal(missingKey.response.status, 422);
  });
});


test('requireAuth mode returns authentication_required instead of silently using demo-user when no bearer is present', async () => {
  const secret = 'billing-require-auth-test-secret';
  await withServer(async (base) => {
    const anonymous = await json(`${base}/api/v1/billing`);
    assert.equal(anonymous.response.status, 401);
    assert.equal(anonymous.body.error, 'authentication_required');
  }, { requireAuth: true, authSecret: secret });
});

test('production auth mode rejects anonymous billing reads and accepts the canonical Studio bearer', async () => {
  const secret = 'billing-auth-test-secret';
  await withServer(async (base, server) => {
    // Provision demo-user billing capabilities explicitly since requireAuth gates auto-elevation
    const { updateCapabilities } = await import('../src/user/user-store.mjs');
    updateCapabilities('demo-user', ['billing.read', 'billing.manage']);

    const anonymous = await json(`${base}/api/v1/billing`);
    assert.equal(anonymous.response.status, 401);
    assert.equal(anonymous.body.error, 'authentication_required');
    assert.match(anonymous.response.headers.get('cache-control') || '', /no-store/i);

    const token = issueMagicToken({ userId: 'demo-user', secret });
    const authenticated = await json(`${base}/api/v1/billing?actor=demo-user`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(authenticated.response.status, 200);
    assert.ok(Array.isArray(authenticated.body.billing.customers));
    assert.match(authenticated.response.headers.get('cache-control') || '', /no-store/i);
  }, { requireAuth: true, authSecret: secret });
});


test('issued invoice artifact endpoint returns a PDF and rejects drafts', async () => {
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      number: '1370',
      issueDate: '2026-09-11',
    }, 'artifact-draft'));
    const id = draft.body.invoice.id;

    const before = await fetch(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/artifact`);
    assert.equal(before.status, 422);

    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'artifact-issue'));
    const artifact = await fetch(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/artifact`);
    const bytes = Buffer.from(await artifact.arrayBuffer());
    assert.equal(artifact.status, 200);
    assert.equal(artifact.headers.get('content-type'), 'application/pdf');
    assert.match(artifact.headers.get('content-disposition') || '', /invoice-1370\.pdf/);
    assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-');
  });
});

test('delivery endpoint records a provider receipt', async () => {
  const seen = [];
  const adapter = {
    name: 'test-mail',
    async deliver(context) {
      seen.push({ invoice: context.invoice.id, customer: context.customer.id });
      return { messageId: 'provider-msg-42', deliveredAt: '2026-09-11T15:00:00.000Z' };
    },
  };
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      number: '1370',
      issueDate: '2026-09-11',
    }, 'delivery-draft'));
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'delivery-issue'));

    const delivered = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/deliver`, post({}, 'delivery-send'));
    assert.equal(delivered.response.status, 200);
    assert.equal(delivered.body.invoice.status, 'emailed');
    assert.equal(delivered.body.invoice.delivery.provider, 'test-mail');
    assert.equal(delivered.body.invoice.delivery.messageId, 'provider-msg-42');
    assert.deepEqual(seen, [{ invoice: id, customer: 'customer-katrine' }]);
  }, { billingDeliveryAdapter: adapter });
});

test('concurrent delivery requests make one provider call and reject the second claim', async () => {
  const seen = [];
  let releaseProvider;
  let providerStartedResolve;
  const providerStarted = new Promise((resolve) => { providerStartedResolve = resolve; });
  const providerReleased = new Promise((resolve) => { releaseProvider = resolve; });
  const adapter = {
    name: 'test-mail',
    async deliver(context) {
      seen.push({
        invoice: context.invoice.id,
        attemptId: context.attemptId,
      });
      providerStartedResolve();
      await providerReleased;
      return { messageId: 'provider-concurrent-42', deliveredAt: '2026-09-11T15:00:00.000Z' };
    },
  };
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      number: '1370',
      issueDate: '2026-09-11',
    }, 'delivery-concurrent-draft'));
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'delivery-concurrent-issue'));

    const first = json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/deliver`, post({}, 'delivery-concurrent-first'));
    await providerStarted;
    const second = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/deliver`, post({}, 'delivery-concurrent-second'));
    assert.equal(second.response.status, 409);
    assert.equal(second.body.error, 'delivery_in_progress');
    assert.equal(seen.length, 1);

    releaseProvider();
    const delivered = await first;
    assert.equal(delivered.response.status, 200);
    assert.equal(delivered.body.invoice.status, 'emailed');
    assert.equal(delivered.body.invoice.delivery.attemptId, seen[0].attemptId);
  }, { billingDeliveryAdapter: adapter });
});

test('delivery endpoint fails closed when no provider is configured', async () => {
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'],
      number: '1370', issueDate: '2026-09-11',
    }, 'delivery-none-draft'));
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'delivery-none-issue'));
    const result = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/deliver`, post({}, 'delivery-none-send'));
    assert.equal(result.response.status, 503);
    assert.equal(result.body.error, 'delivery_provider_unavailable');
  });
});

test('issued invoice exposes canonical semantic document as no-store JSON', async () => {
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'], issueDate: '2026-09-11',
    }, 'document-canonical-draft'));
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'document-canonical-issue'));
    const result = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/document`);
    assert.equal(result.response.status, 200);
    assert.equal(result.body.document.schema, 'aftergraph.invoice.semantic.v1');
    assert.equal(result.body.document.number, '1370');
    assert.match(result.response.headers.get('cache-control') || '', /no-store/i);
  });
});

test('Peppol export returns preflight errors instead of invalid UBL', async () => {
  await withServer(async (base) => {
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'], issueDate: '2026-09-11',
    }, 'document-peppol-invalid-draft'));
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'document-peppol-invalid-issue'));
    const result = await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/peppol-bis3`);
    assert.equal(result.response.status, 422);
    assert.equal(result.body.error, 'document_profile_validation_failed');
    assert.ok(result.body.errors.includes('buyer_endpoint_required'));
  });
});

test('Peppol export fails closed when the required external validator is unavailable', async () => {
  await withServer(async (base, server) => {
    await server.workspace.store.mutate((draft) => {
      const customer = draft.billing.customers.find((entry) => entry.id === 'customer-katrine');
      customer.countryCode = 'DK';
      customer.registrationId = '12345678';
      customer.registrationSchemeId = '0184';
      customer.endpoint = { schemeId: '0184', value: '12345678' };
      return draft;
    });
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine',
      visitIds: ['katrine-2026-09-07'],
      issueDate: '2026-09-11',
    }, 'document-peppol-missing-validator-draft'));
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'document-peppol-missing-validator-issue'));

    const response = await fetch(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/peppol-bis3`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.error, 'document_validator_unavailable');
  });
});

test('Peppol export emits UBL only after internal and external validation pass', async () => {
  const validations = [];
  await withServer(async (base, server) => {
    await server.workspace.store.mutate((draft) => {
      const customer = draft.billing.customers.find((entry) => entry.id === 'customer-katrine');
      customer.countryCode = 'DK';
      customer.registrationId = '12345678';
      customer.registrationSchemeId = '0184';
      customer.endpoint = { schemeId: '0184', value: '12345678' };
      return draft;
    });
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, post({
      customerId: 'customer-katrine', visitIds: ['katrine-2026-09-07'], issueDate: '2026-09-11',
    }, 'document-peppol-valid-draft'));
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, post({}, 'document-peppol-valid-issue'));
    const response = await fetch(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/peppol-bis3`);
    const xml = await response.text();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/xml; charset=utf-8');
    assert.match(xml, /peppol\.eu:2017:poacc:billing:3\.0/);
    assert.equal(validations.length, 1);
    assert.equal(validations[0].profile, 'peppol-bis-3.0-2026-05');
  }, {
    billingDocumentValidator: async ({ profile, xml }) => {
      validations.push({ profile, xml });
      return { ok: true, source: 'test-validator' };
    },
  });
});

test('GET billing endpoints reject authenticated users without billing.read capability', async () => {
  const secret = 'billing-read-capability-test-secret';
  const actor = `billing-read-denied-${Date.now()}`;
  createUser({ id: actor, name: actor, role: 'operator', capabilities: ['billing.manage'] });

  await withServer(async (base) => {
    const token = issueMagicToken({ userId: actor, secret });
    const authHeaders = { authorization: `Bearer ${token}` };

    // First create an issued invoice so artifact/document/peppol endpoints have something to serve
    const draft = await json(`${base}/api/v1/billing/invoices/draft`, {
      ...postAs(actor, {
        customerId: 'customer-katrine',
        visitIds: ['katrine-2026-09-07'],
        number: '1399',
        issueDate: '2026-09-11',
      }, 'billing-read-denied-draft'),
      headers: { ...postAs(actor, {}, '_').headers, ...authHeaders },
    });
    assert.equal(draft.response.status, 201);
    const id = draft.body.invoice.id;
    await json(`${base}/api/v1/billing/invoices/${encodeURIComponent(id)}/issue`, {
      ...postAs(actor, {}, 'billing-read-denied-issue'),
      headers: { ...postAs(actor, {}, '_').headers, ...authHeaders },
    });

    const endpoints = [
      `/api/v1/billing?actor=${actor}`,
      `/api/v1/billing/invoices/${encodeURIComponent(id)}/artifact`,
      `/api/v1/billing/invoices/${encodeURIComponent(id)}/document`,
      `/api/v1/billing/invoices/${encodeURIComponent(id)}/peppol-bis3`,
    ];

    for (const path of endpoints) {
      const result = await json(`${base}${path}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(result.response.status, 403, `Expected 403 on ${path}, got ${result.response.status}`);
      assert.equal(result.body.error, 'forbidden');
    }
  }, { requireAuth: true, authSecret: secret });
});

test('unknown claimedActor returns 422 on billing endpoints', async () => {
  await withServer(async (base) => {
    const result = await json(`${base}/api/v1/billing/actuals`, postAs('nonexistent-actor', {
      visitId: 'test-visit',
      actual: { workMinutes: 60, workers: 1, startedAt: '2026-09-01T08:00:00Z', endedAt: '2026-09-01T09:00:00Z' },
    }, 'unknown-actor-test'));
    assert.equal(result.response.status, 422);
    assert.equal(result.body.error, 'unknown_actor');
  });
});

test('company settings update persists per billing workspace and protects invoice sequence', async () => {
  await withServer(async (base) => {
    const update = await json(`${base}/api/v1/billing/settings`, post({
      issuer: {
        name: 'Pilot ApS', address: 'Pilotvej 1, 8000 Aarhus', countryCode: 'DK',
        registrationId: '12345678', registrationSchemeId: '0184',
        endpoint: { schemeId: '0184', value: '12345678' },
        email: 'billing@pilot.example', paymentText: 'Bank transfer',
      },
      defaultServiceLabel: 'Rengøring og service',
      invoiceSequence: { nextNumber: 2000 },
    }, 'billing-settings-1'));
    assert.equal(update.response.status, 200);
    assert.equal(update.body.billing.settings.issuer.name, 'Pilot ApS');
    assert.equal(update.body.billing.settings.invoiceSequence.nextNumber, 2000);

    const read = await json(`${base}/api/v1/billing`);
    assert.equal(read.body.billing.settings.defaultServiceLabel, 'Rengøring og service');
  });
});
