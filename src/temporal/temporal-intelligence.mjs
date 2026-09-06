// V7.3 Temporal Intelligence — deterministic replay primitives.
// ponytail: one pure module over durable events; no store, timer, or executor.
// Forecasts and branches are observations only. Persistence can be added when
// a canonical temporal owner exists.

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function clone(value) {
  return structuredClone(value);
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function patchFor(event) {
  const patch = event?.patch ?? event?.statePatch ?? {};
  if (!isObject(patch)) throw new TypeError('temporal patch must be an object');
  for (const key of Object.keys(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) {
      throw new TypeError('unsafe temporal patch key');
    }
  }
  return patch;
}

function safeIndex(frames, index) {
  if (!frames.length) return -1;
  const n = Number(index);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(frames.length - 1, Math.trunc(n)));
}

export function buildTemporalFrames(events = [], initialState = {}) {
  if (!Array.isArray(events)) throw new TypeError('temporal events must be an array');
  if (!isObject(initialState)) throw new TypeError('initial temporal state must be an object');
  let state = clone(initialState);
  const frames = events.map((event, index) => {
    if (!isObject(event) || !event.id) throw new TypeError('temporal event requires id');
    state = { ...state, ...clone(patchFor(event)) };
    return freeze({
      index,
      event: clone(event),
      state: clone(state),
      cursor: String(event.id),
      authority: 'none',
    });
  });
  return Object.freeze(frames);
}

export function reconstructAt(frames = [], index = 0) {
  if (!Array.isArray(frames) || !frames.length) return null;
  return clone(frames[safeIndex(frames, index)].state);
}

export function counterfactualAt(frames = [], index = 0, hypotheticalEvent) {
  if (!Array.isArray(frames) || !frames.length) throw new RangeError('counterfactual requires temporal frames');
  const baseIndex = safeIndex(frames, index);
  const event = clone(hypotheticalEvent);
  if (!isObject(event) || !event.id) event.id = `counterfactual_${baseIndex}`;
  const state = { ...reconstructAt(frames, baseIndex), ...clone(patchFor(event)) };
  return freeze({ baseIndex, event, state, mode: 'counterfactual', authority: 'none', executed: false });
}

export function futureTrajectory(frames = [], index = 0, steps = []) {
  if (!Array.isArray(frames) || !frames.length) throw new RangeError('future trajectory requires temporal frames');
  if (!Array.isArray(steps)) throw new TypeError('forecast steps must be an array');
  const baseIndex = safeIndex(frames, index);
  const normalized = steps.map((step, i) => {
    if (!isObject(step) || !step.id || !step.label) throw new TypeError(`forecast step ${i} requires id and label`);
    const confidence = Number(step.confidence);
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) throw new RangeError('forecast confidence must be between 0 and 1');
    return Object.freeze({ id: String(step.id), label: String(step.label), confidence });
  });
  return freeze({ baseIndex, from: frames[baseIndex].cursor, steps: normalized, mode: 'forecast', authority: 'none', executed: false });
}
