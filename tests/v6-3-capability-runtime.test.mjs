import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapabilityRegistry } from '../src/federation/capability-registry.mjs';
import { createCapabilityRuntime } from '../src/runtime/capability-runtime.mjs';
import { createEvidenceGraph } from '../src/federation/evidence-graph.mjs';

function mockCap({ id, kind = 'skill', source = 'skills-vault', risk = 'low', policy = {} }) {
  return {
    id,
    kind,
    source,
    risk,
    policy,
    description: `Test capability ${id}`,
    discoverable: true,
    authority: [{ owner: source, operations: [`${id}.execute`] }]
  };
}

test('CapabilityRuntime: registers typed capabilities across all 5 kinds', () => {
  const registry = createCapabilityRegistry();
  const kinds = ['skill', 'agent', 'tool', 'model', 'provider'];

  for (const kind of kinds) {
    const registered = registry.register(mockCap({ id: `${kind}:test-1`, kind, source: 'test-src' }));
    assert.equal(registered.kind, kind);
    assert.equal(registered.id, `${kind}:test-1`);
  }

  const discovered = registry.discover('test-1');
  assert.equal(discovered.length, 5);
});

test('INVARIANT: DiscoveryNeverEqualsGrant — discovery does not authorize execution', async () => {
  const registry = createCapabilityRegistry({
    resolveGrant: (subject, cap) => subject === 'admin' // Only admin has grant
  });
  const evidence = createEvidenceGraph();
  const runtime = createCapabilityRuntime({ registry, evidence });

  registry.register(mockCap({ id: 'tool:system:reboot', kind: 'tool', source: 'trust-gateway' }));

  // Discovery works for regular user
  const found = registry.discover('reboot');
  assert.equal(found.length, 1);
  assert.equal(registry.grantStatus('guest', 'tool:system:reboot'), 'not-granted');

  // Attempted execution without grant FAILS CLOSED
  await assert.rejects(
    () => runtime.executeCapability({
      capabilityId: 'tool:system:reboot',
      subject: 'guest',
      inputs: {}
    }),
    /capability_not_granted/
  );
});

test('Policy & Authority Evaluation: critical risk capability requires explicit TG approval', async () => {
  const registry = createCapabilityRegistry({
    resolveGrant: () => true // Granted by role
  });
  const evidence = createEvidenceGraph();
  const runtime = createCapabilityRuntime({ registry, evidence });

  registry.register(mockCap({
    id: 'skill:model:fine-tune',
    kind: 'skill',
    source: 'skills-vault',
    risk: 'critical',
    policy: { requiresApproval: true }
  }));

  // Execution without TG approval token fails
  await assert.rejects(
    () => runtime.executeCapability({
      capabilityId: 'skill:model:fine-tune',
      subject: 'developer',
      inputs: { dataset: 'corp-data' },
      authorization: null
    }),
    /authority_approval_required/
  );

  // Execution WITH valid TG approval succeeds
  const result = await runtime.executeCapability({
    capabilityId: 'skill:model:fine-tune',
    subject: 'developer',
    inputs: { dataset: 'corp-data' },
    authorization: { approvalId: 'app-tg-99', approvedBy: 'human-admin', status: 'approved' },
    executor: async (inputs) => ({ modelTuned: true, steps: 100 })
  });

  assert.equal(result.ok, true);
  assert.equal(result.outputs.modelTuned, true);
  assert.ok(result.evidenceRef, 'Evidence record must be generated');
});

test('Budget Constraints: execution fails closed when budget limit is exceeded', async () => {
  const registry = createCapabilityRegistry({ resolveGrant: () => true });
  const evidence = createEvidenceGraph();
  const runtime = createCapabilityRuntime({ registry, evidence });

  registry.register(mockCap({
    id: 'model:claude-3-7:inference',
    kind: 'model',
    source: 'avc',
    policy: { maxCost: 10.0 }
  }));

  // Budget context allows up to 5.0, but task requires 12.0
  await assert.rejects(
    () => runtime.executeCapability({
      capabilityId: 'model:claude-3-7:inference',
      subject: 'researcher',
      inputs: { prompt: 'Deep reasoning' },
      budgetContext: { availableBudget: 5.0, estimatedCost: 12.0 }
    }),
    /capability_budget_exceeded/
  );
});

test('Execution Evidence: records verifiable evidence in EvidenceGraph upon completion', async () => {
  const registry = createCapabilityRegistry({ resolveGrant: () => true });
  const evidence = createEvidenceGraph();
  const runtime = createCapabilityRuntime({ registry, evidence });

  registry.register(mockCap({
    id: 'provider:github:create-pr',
    kind: 'provider',
    source: 'trust-gateway'
  }));

  const res = await runtime.executeCapability({
    capabilityId: 'provider:github:create-pr',
    subject: 'hermes-worker',
    inputs: { branch: 'feat/v6-3' },
    executor: async () => ({ prNumber: 42, url: 'https://github.com/org/repo/pull/42' })
  });

  assert.equal(res.ok, true);
  const recorded = evidence.getEvidence(res.evidenceRef);
  assert.ok(recorded, 'Evidence must be stored in graph');
  assert.equal(recorded.class, 'capability-execution');
  assert.equal(recorded.owner, 'trust-gateway');
  assert.equal(recorded.status, 'verified');
});

test('EXIT GATE: Discovery != Grant; capability execution fully governed across all 5 kinds', async () => {
  const registry = createCapabilityRegistry({
    resolveGrant: (subj, cap) => subj === 'authorized-agent'
  });
  const evidence = createEvidenceGraph();
  const runtime = createCapabilityRuntime({ registry, evidence });

  const allKinds = ['skill', 'agent', 'tool', 'model', 'provider'];
  for (const kind of allKinds) {
    registry.register(mockCap({
      id: `${kind}:production-task`,
      kind,
      source: 'aftergraph-kernel',
      risk: 'medium'
    }));
  }

  for (const kind of allKinds) {
    const id = `${kind}:production-task`;

    // 1. Discovery is open
    const found = registry.discover(id);
    assert.equal(found.length, 1);

    // 2. Unauthorized subject CANNOT execute
    await assert.rejects(
      () => runtime.executeCapability({ capabilityId: id, subject: 'unauthorized-user', inputs: {} }),
      /capability_not_granted/,
      `${kind} must reject execution for unauthorized subject`
    );

    // 3. Authorized subject executes with full evidence attestation
    const result = await runtime.executeCapability({
      capabilityId: id,
      subject: 'authorized-agent',
      inputs: { test: true },
      executor: async () => ({ success: true })
    });

    assert.equal(result.ok, true);
    assert.ok(result.evidenceRef);
    assert.equal(evidence.getEvidence(result.evidenceRef).status, 'verified');
  }
});
