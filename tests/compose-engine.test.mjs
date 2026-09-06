import test from 'node:test';
import assert from 'node:assert/strict';
import { composePlan } from '../src/compose-engine.mjs';

test('destructive risk forces control gate before action surfaces', () => {
  const plan = composePlan({ domain:'work', intent:'execute', risk:'destructive', approvalState:'none', capabilities:['work.execute'], device:'desktop' });
  assert.equal(plan.surfaces[0].kind, 'approval-gate');
  assert.equal(plan.dimBackground, true);
  assert.ok(plan.omitted.some(x => x.reason === 'risk'));
});

test('awaiting approval pins needs-you queue regardless of intent', () => {
  const plan = composePlan({ domain:'chat', intent:'ask', risk:'low', approvalState:'awaiting', capabilities:['chat.send'], device:'desktop' });
  assert.ok(plan.surfaces.some(x => x.kind === 'needs-you'));
});

test('capability-filtered actions are omitted with explicit reason', () => {
  const plan = composePlan({ domain:'control', intent:'execute', risk:'medium', approvalState:'none', capabilities:['approval.read'], device:'desktop' });
  assert.ok(plan.omitted.some(x => x.reason === 'capability'));
});

test('mobile preserves surface class while reducing density', () => {
  const desktop = composePlan({ domain:'output', intent:'inspect', risk:'low', approvalState:'none', capabilities:['artifact.read'], device:'desktop' });
  const mobile = composePlan({ domain:'output', intent:'inspect', risk:'low', approvalState:'none', capabilities:['artifact.read'], device:'mobile' });
  assert.equal(mobile.surfaces[0].kind, desktop.surfaces[0].kind);
  assert.equal(mobile.density, 'summary');
});
