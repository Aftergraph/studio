import test from 'node:test';
import assert from 'node:assert/strict';
import { BILLING_SOURCE_SCHEMA, buildBillingSourceEnvelope } from '../src/billing/source-contract.mjs';
import { syncBillingSource } from '../src/billing/source-sync.mjs';
import { emptyBillingState } from '../src/billing/fixtures.mjs';

test('billing source envelope is versioned and renderer-neutral', () => {
  const envelope = buildBillingSourceEnvelope({ sourceId: 'pilot-ops', revision: 'r1', syncedAt: '2026-09-11T20:00:00.000Z', customers: [], visits: [] });
  assert.equal(BILLING_SOURCE_SCHEMA, 'aftergraph.billing.source.v1');
  assert.equal(envelope.schema, BILLING_SOURCE_SCHEMA);
  assert.equal(envelope.source.id, 'pilot-ops');
});

test('source sync rejects unsupported envelope versions', () => {
  const bad = { schema: 'aftergraph.billing.source.v0', source: { id: 'pilot-ops', revision: 'r1', syncedAt: '2026-09-11T20:00:00.000Z' }, customers: [], visits: [] };
  assert.throws(
    () => syncBillingSource(emptyBillingState(), bad),
    (error) => error?.code === 'unsupported_source_schema',
  );
});
