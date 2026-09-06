import test from 'node:test';
import assert from 'node:assert/strict';
import { diffSurfaceEntries } from '../src/spatial-lifecycle.mjs';

test('spatial lifecycle reports only newly entered surfaces',()=>{
  assert.deepEqual(diffSurfaceEntries(new Set(['mission:1']), ['mission:1','artifact:1']), ['artifact:1']);
});

test('spatial lifecycle does not replay entrance motion for stable rerenders',()=>{
  assert.deepEqual(diffSurfaceEntries(new Set(['mission:1','artifact:1']), ['mission:1','artifact:1']), []);
});

test('spatial lifecycle permits a closed surface to animate when it enters again',()=>{
  const previous=new Set(['mission:1','artifact:1']);
  const afterClose=['mission:1'];
  assert.deepEqual(diffSurfaceEntries(previous,afterClose),[]);
  assert.deepEqual(diffSurfaceEntries(new Set(afterClose),['mission:1','artifact:1']),['artifact:1']);
});
