import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderWorkView } from '../src/views/work-view.mjs';
import { renderSpaceView } from '../src/views/space-view.mjs';

const bootstrap=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');
const composer='<form data-ag-component="composer"></form>';

test('Work and Space host the same first-party composer contract',()=>{
  const work=renderWorkView({header:'H',composer});
  const space=renderSpaceView({canvas:'C',composer});
  assert.match(work,/ag-work-primary/);
  assert.match(work,/ag-work-composer/);
  assert.equal((work.match(/data-ag-component="composer"/g)||[]).length,1);
  assert.equal((space.match(/data-ag-component="composer"/g)||[]).length,1);
});

test('Chat Work and Space resolve composer context from Active Context',()=>{
  assert.match(bootstrap,/function renderSharedComposer/);
  assert.match(bootstrap,/deriveActiveContext\(state,ui,ui\.backendStatus/);
  assert.ok((bootstrap.match(/renderSharedComposer\(/g)||[]).length>=4);
});

test('Work composer is anchored below the scrollable execution surface',()=>{
  const css=readFileSync(new URL('../styles/views.css',import.meta.url),'utf8');
  assert.match(css,/\.ag-work-primary\s*\{[^}]*grid-template-rows\s*:\s*minmax\(0,1fr\)\s+auto/s);
  assert.match(css,/\.ag-work-composer\s*\{/);
});
