// V83-autonomy-03: hub halt wiring + kill-switch UI — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { MissionRuntimeHub } from '../src/server-runtime-hub.mjs';
import { AGKillSwitch } from '../packages/ui/system/event-row.mjs';

function fakeStore() {
  let state = {
    missions: [{ id: 'mH', state: 'running', progress: 10, steps: [{ state: 'running' }, { state: 'pending' }], evidenceCount: 1 }],
  };
  return {
    snapshot: () => structuredClone(state),
    replace: async next => { state = structuredClone(next); return state; },
  };
}

test('Autonomy hub: halted mission pauses instead of advancing', async () => {
  let hub;
  try {
    hub = new MissionRuntimeHub({ store: fakeStore(), intervalMs: 100000, isHalted: id => id === 'mH' });
  } catch {
    assert.fail('MissionRuntimeHub must accept isHalted');
  }
  await hub.start('mH');
  const before = hub.runtime('mH').tick;
  await hub.step('mH');
  const runtime = hub.runtime('mH');
  assert.equal(runtime.status, 'paused', 'halted mission must pause');
  assert.equal(runtime.tick, before, 'halted mission must not advance');
  assert.equal(runtime.attention?.type, 'kill', 'pause reason must name kill switch');
  hub.stopAll();
});

test('Autonomy hub: unhalted mission advances normally', async () => {
  const hub = new MissionRuntimeHub({ store: fakeStore(), intervalMs: 100000 });
  await hub.start('mH');
  await hub.step('mH');
  const runtime = hub.runtime('mH');
  assert.equal(runtime.status, 'running');
  assert.equal(runtime.tick, 1);
  hub.stopAll();
});

test('Kill UI: disengaged switch offers engage with description', () => {
  assert.ok(AGKillSwitch, 'AGKillSwitch must exist');
  const html = AGKillSwitch({ scope: 'mission:mH', engaged: false, missionTitle: 'Q4 report' });
  assert.ok(html.includes('data-action="engage-kill"'), 'must offer engage');
  assert.ok(html.includes('mission:mH'), 'scope must be visible');
  assert.ok(html.includes('aria-describedby'), 'engage must describe impact');
  assert.ok(!html.includes('data-action="release-kill"'), 'no release when disengaged');
});

test('Kill UI: engaged switch offers release only and names scope', () => {
  const html = AGKillSwitch({ scope: 'mission:mH', engaged: true, missionTitle: 'Q4 report' });
  assert.ok(html.includes('data-action="release-kill"'), 'must offer release');
  assert.ok(!html.includes('data-action="engage-kill"'), 'no engage when engaged');
  assert.ok(html.includes('engaged'), 'state must be visible');
});

test('Kill UI: pending action disables controls', () => {
  const html = AGKillSwitch({ scope: 'mission:mH', engaged: false, missionTitle: 'Q4', pendingAction: 'engage-kill' });
  assert.ok(html.includes('disabled'), 'controls disabled while pending');
  assert.ok(!html.includes('data-action="engage-kill"'), 'no clickable engage while pending');
});
