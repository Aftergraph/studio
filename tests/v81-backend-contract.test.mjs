// P0 V81-015 regression tests: one backend payload validation boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { validateWorkspacePayload } from '../src/backend-reconciliation.mjs';

test('backend contract accepts canonical workspace payload without mutating it', () => {
  const payload = { version: 'aftergraph.workspace.v5', state: createInitialState({ fixtures: false }), runtimes: {} };
  const copy = structuredClone(payload);
  assert.equal(validateWorkspacePayload(payload), payload);
  assert.deepEqual(payload, copy);
});

test('backend contract rejects missing or malformed canonical state', () => {
  for (const payload of [null, {}, { state: null }, { state: [] }, { state: { missions: {} } }, { state: { missions: [], agents: 'not-an-array' } }]) {
    assert.throws(() => validateWorkspacePayload(payload), /workspace payload|state|missions|agents/i);
  }
});

test('backend contract rejects malformed nested records instead of synthesizing defaults', () => {
  const state = createInitialState({ fixtures: false });
  state.missions = [{ id: null }];
  assert.throws(() => validateWorkspacePayload({ state }), /mission|id/i);
});
