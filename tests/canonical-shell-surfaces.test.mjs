import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('contextual products render inside the canonical Studio frame',()=>{
  assert.match(bootstrap,/function renderCanonicalSurface/);
  assert.match(bootstrap,/ui\.activeSurface/);
  for(const id of ['projects','plugins','remote','settings','billing']){
    assert.match(bootstrap,new RegExp(`case '${id}'`));
  }
});

test('surface navigation stays internal and base-aware',()=>{
  assert.match(bootstrap,/function navigateSurface/);
  assert.match(bootstrap,/withAppBase\(surface\.route,routeBase\)/);
  assert.doesNotMatch(bootstrap,/window\.location\.assign\([^)]*billing/i);
});