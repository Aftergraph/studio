import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const src=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('bootstrap routes background backend payloads through render scheduler',()=>{
  assert.match(src,/renderScheduler\.update\(nextState,nextRuntimes\)/);
  assert.doesNotMatch(src,/const patchOnly=isRuntimePatchOnly/);
});

test('bootstrap owns SSE lifecycle through createBackendSession rather than direct subscribe',()=>{
  assert.match(src,/createBackendSession\(\{/);
  assert.match(src,/backendSession\.start\(\)/);
  assert.doesNotMatch(src,/unsubscribeBackend=apiClient\.subscribe/);
});
