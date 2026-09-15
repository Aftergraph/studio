import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
const uiState=readFileSync(new URL('../src/app/ui-state.mjs',import.meta.url),'utf8');

test('bootstrap consumes canonical base-aware navigation contracts',()=>{
  assert.match(bootstrap,/withAppBase/);
  assert.match(bootstrap,/MOBILE_PRIMARY_MODES/);
  assert.match(bootstrap,/SIDEBAR_DESTINATIONS/);
});

test('mobile drawer is explicit UI state and not a second application shell',()=>{
  assert.match(uiState,/mobileSidebarOpen:false/);
  assert.match(bootstrap,/data-action="toggle-sidebar"/);
  assert.match(bootstrap,/ag-mobile-backdrop/);
  assert.match(bootstrap,/is-mobile-open/);
});

test('mobile segmented control renders exactly the mobile primary registry',()=>{
  assert.match(bootstrap,/MOBILE_PRIMARY_MODES\.map/);
});
