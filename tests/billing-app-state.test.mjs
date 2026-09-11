import test from 'node:test';
import assert from 'node:assert/strict';
import { canFinanciallyMutate, itemsForBillingView } from '../src/billing/app-state.mjs';

test('financial mutation availability depends on canonical freshness, not transient busy state', () => {
  assert.equal(canFinanciallyMutate({ online: true, cached: false }), true);
  assert.equal(canFinanciallyMutate({ online: false, cached: false }), false);
  assert.equal(canFinanciallyMutate({ online: true, cached: true }), false);
});

test('billing inbox prioritizes missing information, then ready, then waiting', () => {
  const items = [
    { id: 'wait', status: 'waiting' },
    { id: 'ready', status: 'ready' },
    { id: 'done', status: 'invoiced' },
    { id: 'missing', status: 'needs_info' },
  ];
  assert.deepEqual(itemsForBillingView(items, 'inbox').map((item) => item.id), ['missing', 'ready', 'wait']);
  assert.deepEqual(itemsForBillingView(items, 'invoiced').map((item) => item.id), ['done']);
});
