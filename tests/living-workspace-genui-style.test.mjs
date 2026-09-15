import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const views=await readFile(new URL('../styles/views.css',import.meta.url),'utf8');
const responsive=await readFile(new URL('../styles/responsive.css',import.meta.url),'utf8');

test('generated UI uses first-party open-surface visual treatment with explicit action states',()=>{
  assert.match(views,/\.ag-generated-surface\{/);
  assert.match(views,/\.ag-genui-action\{/);
  assert.match(views,/data-interaction-state="prepared"/);
  assert.match(views,/\.ag-genui-fallback\{/);
});

test('generated action controls meet mobile touch target contract',()=>{
  assert.match(responsive,/@media\s*\(max-width:\s*760px\)/);
  assert.match(responsive,/\.ag-genui-action button[^}]*min-height:\s*44px/);
});
