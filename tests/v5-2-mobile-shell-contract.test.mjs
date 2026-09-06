import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const bootstrap=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
const responsive=readFileSync(new URL('../styles/responsive.css',import.meta.url),'utf8');

test('mobile shell exposes a dedicated primary mode nav contract',()=>{
  assert.match(bootstrap,/data-mobile-primary-nav="true"/);
  assert.match(bootstrap,/aria-label="Primary workspace modes"/);
  assert.match(responsive,/@media\s*\(max-width:760px\)[\s\S]*\.ag-sidebar\s*\{[^}]*display:none/);
  assert.match(responsive,/\.ag-mode-switch\s*\{[^}]*position:fixed[^}]*bottom:/);
});

test('mobile shell reserves safe area for composer and mode navigation',()=>{
  assert.match(responsive,/env\(safe-area-inset-bottom/);
  assert.match(responsive,/\.ag-calm-composer-wrap[^}]*padding-bottom:/);
});
