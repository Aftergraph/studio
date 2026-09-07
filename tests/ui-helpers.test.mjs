import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, attentionCount, missionStatusLabel, compactMoney } from '../src/ui-helpers.mjs';
import { createInitialState } from '../src/state.mjs';

test('escapeHtml neutralizes executable markup', () => {
  assert.equal(escapeHtml('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
});

test('attention count includes unresolved needs and pending approvals without double counting linked approval', () => {
  const state = createInitialState();
  assert.equal(attentionCount(state), 4);
});

test('mission status distinguishes verified from merely completed', () => {
  assert.equal(missionStatusLabel({ state:'verified', verified:true }), 'Verified');
  assert.equal(missionStatusLabel({ state:'completed_unverified', verified:false }), 'Completed · unverified');
});

test('money formatting is compact and stable', () => {
  assert.equal(compactMoney(8.49, '€'), '8,49 €');
});
