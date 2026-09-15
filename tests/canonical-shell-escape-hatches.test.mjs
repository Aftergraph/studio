import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
const workView=readFileSync(new URL('../src/views/work-view.mjs',import.meta.url),'utf8');

test('canonical navigation clears stale contextual surfaces',()=>{
  assert.match(bootstrap,/function navigateDomain[\s\S]*ui\.activeSurface=null/);
  assert.match(bootstrap,/case 'new-chat':[\s\S]*ui\.activeSurface=null/);
  assert.match(bootstrap,/case 'new-goal':[\s\S]*ui\.activeSurface=null/);
});

test('contextual surfaces never falsely select Chat',()=>{
  assert.match(bootstrap,/if\(ui\.activeSurface\)/);
  assert.match(bootstrap,/return null/);
});

test('Work Billing launcher stays inside canonical Studio shell',()=>{
  assert.doesNotMatch(workView,/href="\/billing\//);
  assert.match(workView,/data-shell-destination="billing"/);
});