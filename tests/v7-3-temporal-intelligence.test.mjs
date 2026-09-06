// V7.3 Temporal Intelligence exit tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTemporalFrames,
  reconstructAt,
  counterfactualAt,
  futureTrajectory,
} from '../src/temporal/temporal-intelligence.mjs';
import { AGReplayTimeline } from '../packages/visualization/index.mjs';

const events = [
  { id: 'e1', type: 'mission.started', time: '10:00', patch: { status: 'running', progress: 0 } },
  { id: 'e2', type: 'mission.progressed', time: '10:05', patch: { progress: 50 } },
  { id: 'e3', type: 'evidence.sealed', time: '10:10', patch: { verified: true } },
];

test('Temporal: frames are chronological and immutable', () => {
  const frames = buildTemporalFrames(events, { status: 'new', progress: 0, verified: false });
  assert.deepEqual(frames.map(f => f.event.id), ['e1', 'e2', 'e3']);
  assert.equal(frames[1].state.progress, 50);
  assert.ok(Object.isFrozen(frames[1]));
  assert.ok(Object.isFrozen(frames[1].state));
});

test('Temporal: historical reconstruction is deterministic at every cursor', () => {
  const frames = buildTemporalFrames(events, { status: 'new', progress: 0, verified: false });
  assert.deepEqual(reconstructAt(frames, 0), { status: 'running', progress: 0, verified: false });
  assert.deepEqual(reconstructAt(frames, 1), { status: 'running', progress: 50, verified: false });
  assert.deepEqual(reconstructAt(frames, 99), { status: 'running', progress: 50, verified: true });
});

test('Temporal: malformed patches fail closed', () => {
  assert.throws(() => buildTemporalFrames([{ id: 'bad', type: 'x', patch: '<markup>' }], {}), /patch|object/i);
});

test('Temporal: counterfactual branches from history without mutating it', () => {
  const frames = buildTemporalFrames(events, { status: 'new', progress: 0, verified: false });
  const branch = counterfactualAt(frames, 1, { type: 'mission.cancelled', patch: { status: 'cancelled' } });
  assert.equal(branch.baseIndex, 1);
  assert.equal(branch.state.status, 'cancelled');
  assert.equal(branch.state.progress, 50);
  assert.equal(frames[1].state.status, 'running');
  assert.equal(branch.authority, 'none');
});

test('Temporal: future trajectory is an explicit forecast, never an execution', () => {
  const frames = buildTemporalFrames(events, { status: 'new', progress: 0, verified: false });
  const forecast = futureTrajectory(frames, 1, [
    { id: 'f1', label: 'Review evidence', confidence: 0.8 },
    { id: 'f2', label: 'Publish outcome', confidence: 0.4 },
  ]);
  assert.deepEqual(forecast.steps.map(s => s.id), ['f1', 'f2']);
  assert.equal(forecast.baseIndex, 1);
  assert.equal(forecast.authority, 'none');
  assert.equal(forecast.executed, false);
  assert.ok(Object.isFrozen(forecast));
});

test('Temporal: replay UI exposes historical, counterfactual and forecast modes', () => {
  const frames = buildTemporalFrames(events, {});
  const html = AGReplayTimeline({ frames, temporalMode: 'historical' });
  assert.match(html, /data-temporal-mode="historical"/);
  assert.match(html, /data-temporal-action="counterfactual"/);
  assert.match(html, /data-temporal-action="forecast"/);
  assert.match(html, /Historical/);
});

test('V7.3 exit: replay, branch and forecast preserve zero authority', () => {
  const frames = buildTemporalFrames(events, { status: 'new' });
  const branch = counterfactualAt(frames, 0, { type: 'mission.cancelled', patch: { status: 'cancelled' } });
  const forecast = futureTrajectory(frames, 0, [{ id: 'f1', label: 'Continue', confidence: 0.5 }]);
  assert.equal(frames[0].authority, 'none');
  assert.equal(branch.authority, 'none');
  assert.equal(forecast.authority, 'none');
});
