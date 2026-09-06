// V81-016 destructive-action guard tests — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createActionGuard, assertActorCapability, RESET_CONFIRMATION } from '../src/action-guard.mjs';
import { AGApproval } from '../packages/ui/trust/approval.mjs';
import { AGConfirmationSheet } from '../packages/ui/trust/confirmation-sheet.mjs';

test('ActionGuard: one idempotency key cannot begin twice inside its window', () => {
  let now = 1000;
  const guard = createActionGuard({ ttlMs: 5000, now: () => now });
  const first = guard.begin('approval:apr1:key1');
  assert.equal(first.state, 'loading');
  assert.throws(() => guard.begin('approval:apr1:key1'), /duplicate|pending|idempot/i);
  now += 5001;
  assert.equal(guard.begin('approval:apr1:key1').state, 'loading');
});

test('ActionGuard: failed request releases key and completed request replays result', () => {
  const guard = createActionGuard({ now: () => 1000 });
  guard.begin('takeover:m1:key1');
  const failed = guard.fail('takeover:m1:key1', 'backend_unavailable');
  assert.deepEqual(failed, { state: 'error', error: 'backend_unavailable' });
  guard.begin('takeover:m1:key1');
  const success = guard.complete('takeover:m1:key1', { status: 'approved' });
  assert.deepEqual(success, { state: 'success', result: { status: 'approved' } });
  assert.deepEqual(guard.replay('takeover:m1:key1'), success);
});

test('ActionGuard: actor capability is fail-closed', () => {
  const state = { user: { id: 'human:alice', capabilities: ['approval.decide'] } };
  assert.equal(assertActorCapability({ state, actor: 'human:alice', capability: 'approval.decide' }), true);
  assert.throws(() => assertActorCapability({ state, actor: 'agent:worker', capability: 'approval.decide' }), /actor|authority|forbidden/i);
  assert.throws(() => assertActorCapability({ state, actor: 'human:alice', capability: 'mission.control' }), /capability|forbidden/i);
  assert.throws(() => assertActorCapability({ state, actor: '', capability: 'approval.decide' }), /actor/i);
});

test('ActionGuard: reset confirmation is explicit', () => {
  assert.equal(typeof RESET_CONFIRMATION, 'string');
  assert.ok(RESET_CONFIRMATION.length >= 8);
});

test('Approval UI: loading disables decisions and describes decision context', () => {
  const html = AGApproval({ id: 'a1', title: 'Deploy', risk: 'high', state: 'loading', why: 'Reason', impact: 'Impact', rollback: 'Rollback' });
  assert.match(html, /aria-describedby="a1-description"/);
  assert.match(html, /id="a1-description"/);
  assert.match(html, /disabled/);
  assert.match(html, /Processing|loading/i);
});

test('ConfirmationSheet UI: state contract exposes keyboard and recovery semantics', () => {
  const html = AGConfirmationSheet({ id: 'confirm-1', title: 'Reset workspace', state: 'error', error: 'Could not reset', confirmLabel: 'Retry' });
  assert.match(html, /<dialog/);
  assert.match(html, /aria-labelledby="confirm-1-title"/);
  assert.match(html, /aria-describedby="confirm-1-description"/);
  assert.match(html, /data-confirmation-state="error"/);
  assert.match(html, /Retry/);
  assert.match(html, /Escape|Cancel/);
});
