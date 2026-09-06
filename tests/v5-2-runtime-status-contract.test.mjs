import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('resyncing and degraded states have explicit non-blocking user-facing copy',()=>{
  assert.match(src,/Reconnecting[^'"`]*refreshing current workspace state/i);
  assert.match(src,/Could not refresh current state[^'"`]*stale data/i);
  assert.doesNotMatch(src,/function backendSessionError\([^)]*\)\{[\s\S]{0,220}?render\(\)/);
});
