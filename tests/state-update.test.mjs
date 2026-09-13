#!/usr/bin/env node
/**
 * Tests for state-update.mjs - path-based state mutations
 */

import * as assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import { createInitialState } from '../src/state.mjs';
import {
  setIn,
  updateArrayElement,
  updateObjectProperty,
  pushToArray,
  removeFromArray,
  filterArray,
  mapArray,
  toPath,
  createStateUpdater
} from '../src/state-update.mjs';

const clone = value => structuredClone(value);

describe('state-update', () => {
  describe('imports', () => {
    it('should import all functions', () => {
      assert.ok(setIn);
      assert.ok(updateArrayElement);
      assert.ok(updateObjectProperty);
      assert.ok(pushToArray);
      assert.ok(removeFromArray);
      assert.ok(filterArray);
      assert.ok(mapArray);
      assert.ok(toPath);
      assert.ok(createStateUpdater);
    });
  });

  describe('toPath', () => {
    it('should convert dot notation to array', () => {
      assert.deepEqual(toPath('missions.0.progress'), ['missions', 0, 'progress']);
    });

    it('should handle numeric strings as numbers', () => {
      const result = toPath('missions.0.steps.1.state');
      assert.deepEqual(result, ['missions', 0, 'steps', 1, 'state']);
    });

    it('should pass through arrays', () => {
      const path = ['missions', 0, 'progress'];
      assert.deepEqual(toPath(path), path);
    });

    it('should handle single string', () => {
      assert.deepEqual(toPath('missions'), ['missions']);
    });
  });

  describe('setIn', () => {
    let initialState;

    beforeEach(() => {
      initialState = createInitialState({ fixtures: true });
    });

    it('should set a top-level property', () => {
      const result = setIn(initialState, ['activeDomain'], 'work');
      assert.equal(result.activeDomain, 'work');
      assert.equal(result.primaryMode, initialState.primaryMode);
    });

    it('should set a nested property', () => {
      const result = setIn(initialState, ['missions', 0, 'progress'], 75);
      assert.equal(result.missions[0].progress, 75);
      assert.equal(result.missions[1].progress, initialState.missions[1].progress);
    });

    it('should set a deeply nested property', () => {
      const result = setIn(initialState, ['missions', 0, 'steps', 0, 'state'], 'completed');
      assert.equal(result.missions[0].steps[0].state, 'completed');
      assert.equal(result.missions[0].steps[1].state, initialState.missions[0].steps[1].state);
    });

    it('should not mutate the original state', () => {
      const originalProgress = initialState.missions[0].progress;
      const result = setIn(initialState, ['missions', 0, 'progress'], 75);
      assert.equal(initialState.missions[0].progress, originalProgress);
    });

    it('should create missing paths', () => {
      const result = setIn(initialState, ['newPath', 'nested', 'value'], 'test');
      assert.equal(result.newPath.nested.value, 'test');
    });

    it('should handle array indices', () => {
      const result = setIn(initialState, ['missions', 0, 'newField'], 'added');
      assert.equal(result.missions[0].newField, 'added');
    });
  });

  describe('updateArrayElement', () => {
    it('should update an array element', () => {
      const arr = [{ id: 1, value: 'a' }, { id: 2, value: 'b' }];
      const result = updateArrayElement(arr, 0, el => ({ ...el, value: 'updated' }));
      
      assert.equal(result[0].value, 'updated');
      assert.equal(result[1].value, 'b');
      assert.equal(arr[0].value, 'a'); // Original not mutated
    });

    it('should clone the element being updated', () => {
      const obj = { nested: { value: 1 } };
      const arr = [obj];
      const result = updateArrayElement(arr, 0, el => ({ ...el, nested: { value: 2 } }));
      
      assert.equal(result[0].nested.value, 2);
      assert.equal(arr[0].nested.value, 1);
    });
  });

  describe('updateObjectProperty', () => {
    it('should update an object property', () => {
      const obj = { a: 1, b: 2 };
      const result = updateObjectProperty(obj, 'a', v => v + 10);
      
      assert.equal(result.a, 11);
      assert.equal(result.b, 2);
      assert.equal(obj.a, 1); // Original not mutated
    });

    it('should clone the property being updated', () => {
      const nested = { value: 1 };
      const obj = { nested };
      const result = updateObjectProperty(obj, 'nested', v => ({ ...v, value: 2 }));
      
      assert.equal(result.nested.value, 2);
      assert.equal(obj.nested.value, 1);
    });
  });

  describe('pushToArray', () => {
    let initialState;

    beforeEach(() => {
      initialState = createInitialState({ fixtures: true });
    });

    it('should push to a top-level array', () => {
      const newMission = { id: 'new_mission', title: 'New Mission' };
      const result = pushToArray(initialState, ['missions'], newMission);
      
      assert.equal(result.missions.length, initialState.missions.length + 1);
      assert.equal(result.missions[result.missions.length - 1].id, 'new_mission');
    });

    it('should not mutate the original array', () => {
      const originalLength = initialState.missions.length;
      pushToArray(initialState, ['missions'], { id: 'test' });
      assert.equal(initialState.missions.length, originalLength);
    });

    it('should create array if it does not exist', () => {
      const result = pushToArray(initialState, ['newArray'], { id: 'first' });
      assert.equal(result.newArray.length, 1);
      assert.equal(result.newArray[0].id, 'first');
    });
  });

  describe('removeFromArray', () => {
    let initialState;

    beforeEach(() => {
      initialState = createInitialState({ fixtures: true });
    });

    it('should remove an element by index', () => {
      const result = removeFromArray(initialState, ['missions'], 0);
      assert.equal(result.missions.length, initialState.missions.length - 1);
      assert.equal(result.missions[0].id, initialState.missions[1].id);
    });

    it('should not mutate the original array', () => {
      const originalLength = initialState.missions.length;
      removeFromArray(initialState, ['missions'], 0);
      assert.equal(initialState.missions.length, originalLength);
    });

    it('should handle out of bounds index', () => {
      const result = removeFromArray(initialState, ['missions'], 999);
      assert.equal(result.missions.length, initialState.missions.length);
    });
  });

  describe('filterArray', () => {
    let initialState;

    beforeEach(() => {
      initialState = createInitialState({ fixtures: true });
    });

    it('should filter array elements', () => {
      const result = filterArray(initialState, ['missions'], m => m.progress > 70);
      assert.ok(result.missions.every(m => m.progress > 70));
    });

    it('should not mutate the original array', () => {
      const originalLength = initialState.missions.length;
      filterArray(initialState, ['missions'], m => m.progress > 70);
      assert.equal(initialState.missions.length, originalLength);
    });

    it('should return empty array if no matches', () => {
      const result = filterArray(initialState, ['missions'], m => m.progress > 1000);
      assert.equal(result.missions.length, 0);
    });
  });

  describe('mapArray', () => {
    let initialState;

    beforeEach(() => {
      initialState = createInitialState({ fixtures: true });
    });

    it('should map over array elements', () => {
      const result = mapArray(initialState, ['missions'], m => ({ ...m, doubled: m.progress * 2 }));
      assert.ok(result.missions.every(m => m.doubled === m.progress * 2));
    });

    it('should not mutate the original array', () => {
      const originalProgress = initialState.missions[0].progress;
      mapArray(initialState, ['missions'], m => ({ ...m, doubled: m.progress * 2 }));
      assert.equal(initialState.missions[0].progress, originalProgress);
      assert.equal(initialState.missions[0].doubled, undefined);
    });
  });

  describe('createStateUpdater', () => {
    let initialState;
    let updater;

    beforeEach(() => {
      initialState = createInitialState({ fixtures: true });
      updater = createStateUpdater(initialState);
    });

    it('should get the current state', () => {
      const state = updater.get();
      assert.equal(state.activeDomain, initialState.activeDomain);
    });

    it('should set a value by path', () => {
      const result = updater.set(['missions', 0, 'progress'], 80);
      assert.equal(result.missions[0].progress, 80);
    });

    it('should update a value by path', () => {
      const result = updater.update(['missions', 0], m => ({ ...m, progress: m.progress + 10 }));
      assert.equal(result.missions[0].progress, initialState.missions[0].progress + 10);
    });

    it('should push to an array', () => {
      const newMission = { id: 'test_mission', title: 'Test' };
      const result = updater.push(['missions'], newMission);
      assert.equal(result.missions.length, initialState.missions.length + 1);
      assert.equal(result.missions[result.missions.length - 1].id, 'test_mission');
    });

    it('should remove from an array', () => {
      const result = updater.remove(['missions'], 0);
      assert.equal(result.missions.length, initialState.missions.length - 1);
    });

    it('should filter an array', () => {
      const result = updater.filter(['missions'], m => m.progress > 70);
      assert.ok(result.missions.every(m => m.progress > 70));
    });

    it('should map over an array', () => {
      const result = updater.map(['missions'], m => ({ ...m, test: true }));
      assert.ok(result.missions.every(m => m.test === true));
    });

    it('should replace the entire state', () => {
      const newState = createInitialState({ fixtures: false });
      const result = updater.replace(newState);
      assert.equal(result.missions.length, 0);
    });

    it('should provide snapshot for compatibility', () => {
      const snapshot = updater.snapshot();
      assert.equal(snapshot.activeDomain, initialState.activeDomain);
    });

    it('should maintain immutability', () => {
      const state1 = updater.get();
      updater.set(['missions', 0, 'progress'], 90);
      const state2 = updater.get();
      
      assert.equal(state1.missions[0].progress, initialState.missions[0].progress);
      assert.equal(state2.missions[0].progress, 90);
    });
  });

  describe('performance comparison', () => {
    let initialState;

    beforeEach(() => {
      initialState = createInitialState({ fixtures: true });
    });

    it('should be faster than full clone for single property update', () => {
      const start1 = Date.now();
      for (let i = 0; i < 100; i++) {
        const state = clone(initialState);
        state.missions[0].progress = 50;
      }
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      for (let i = 0; i < 100; i++) {
        setIn(initialState, ['missions', 0, 'progress'], 50);
      }
      const time2 = Date.now() - start2;

      // setIn should be at least 2x faster for this operation
      // (it only clones the path, not the entire state)
      console.log(`Full clone: ${time1}ms, setIn: ${time2}ms, ratio: ${(time1/time2).toFixed(2)}x`);
      assert.ok(time2 < time1, `setIn (${time2}ms) should be faster than full clone (${time1}ms)`);
    });

    it('should be faster for array element updates', () => {
      const start1 = Date.now();
      for (let i = 0; i < 100; i++) {
        const arr = clone(initialState.missions);
        arr[0] = { ...arr[0], progress: 50 };
      }
      const time1 = Date.now() - start1;

      const start2 = Date.now();
      for (let i = 0; i < 100; i++) {
        updateArrayElement(initialState.missions, 0, m => ({ ...m, progress: 50 }));
      }
      const time2 = Date.now() - start2;

      console.log(`Full array clone: ${time1}ms, updateArrayElement: ${time2}ms, ratio: ${(time1/time2).toFixed(2)}x`);
      assert.ok(time2 < time1, `updateArrayElement (${time2}ms) should be faster than full array clone (${time1}ms)`);
    });
  });
});

// Run with: node tests/state-update.test.mjs
console.log('Running state-update tests...');
