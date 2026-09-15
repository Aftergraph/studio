import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css=readFileSync(new URL('../styles/canonical-shell.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');

test('canonical shell ships as the final explicit style layer',()=>{
  assert.match(html,/styles\/canonical-shell\.css/);
  assert.match(html,/rel=\"icon\" href=\"data:,\"/);
  assert.match(sw,/styles\/canonical-shell\.css/);
  assert.match(css,/\.ag-canonical-surface/);
  assert.match(css,/\.ag-shell-destinations/);
});

test('mobile drawer overlays the same shell with safe-area and accessible targets',()=>{
  assert.match(css,/\.ag-sidebar\.is-mobile-open/);
  assert.match(css,/\.ag-mobile-backdrop/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/min-height:44px/);
  assert.doesNotMatch(css,/\.ag-mode-switch\{[^}]*position:fixed/);
});