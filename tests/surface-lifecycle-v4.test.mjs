import test from 'node:test';
import assert from 'node:assert/strict';
import { createSurfaceLifecycle } from '../src/surface-lifecycle.mjs';

test('surface entrance fires once per closed-to-open lifecycle, not per render',()=>{
  const lifecycle=createSurfaceLifecycle(['artifact','approval']);
  assert.equal(lifecycle.entered('artifact',true),true);
  assert.equal(lifecycle.entered('artifact',true),false);
  assert.equal(lifecycle.entered('artifact',true),false);
  assert.equal(lifecycle.entered('artifact',false),false);
  assert.equal(lifecycle.entered('artifact',true),true);
});

test('independent surfaces do not reset one another',()=>{
  const lifecycle=createSurfaceLifecycle(['artifact','approval']);
  assert.equal(lifecycle.entered('artifact',true),true);
  assert.equal(lifecycle.entered('approval',true),true);
  assert.equal(lifecycle.entered('artifact',true),false);
  assert.equal(lifecycle.entered('approval',false),false);
  assert.equal(lifecycle.entered('approval',true),true);
});
