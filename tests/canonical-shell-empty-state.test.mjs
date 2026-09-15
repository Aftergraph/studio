import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('cold production boot renders safely before backend hydration',()=>{
  assert.match(bootstrap,/function renderEmptyWorkspace/);
  assert.match(bootstrap,/state\.conversations\.length/);
  assert.match(bootstrap,/state\.missions\.length/);
  assert.match(bootstrap,/state\.spaces\?\.length/);
  assert.match(bootstrap,/Connecting to workspace/);
});