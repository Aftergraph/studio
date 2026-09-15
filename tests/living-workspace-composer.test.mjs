import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGComposer } from '../packages/ui/conversation/composer.mjs';

const refs=[
  {type:'mission',id:'mission_q4',label:'Build Q4 business report'},
  {type:'artifact',id:'art_q4',label:'q4_report_draft.md'},
];

test('shared composer exposes selected context and intent preview without changing submit contract',()=>{
  const html=AGComposer({mode:'Research',context:refs,intentHint:'Research within the active mission; no action will execute without review.'});
  assert.match(html,/data-ag-component="composer"/);
  assert.match(html,/data-focus-key="composer-input"/);
  assert.match(html,/data-context-ref="mission:mission_q4"/);
  assert.match(html,/q4_report_draft\.md/);
  assert.match(html,/data-intent-preview/);
  assert.match(html,/Research within the active mission/);
  assert.match(html,/type="submit"/);
});

test('mobile composer keeps primary interaction controls at least 44px',()=>{
  const css=readFileSync(new URL('../styles/views.css',import.meta.url),'utf8');
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.ag-composer-plus[^}]*min-(?:height|block-size)\s*:\s*44px/);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.ag-send[^}]*min-(?:height|block-size)\s*:\s*44px/);
});
