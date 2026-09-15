import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { AGActiveContextBar } from '../packages/ui/system/active-context-bar.mjs';

const context={
  mission:{id:'mission_q4',label:'Build Q4 business report',freshness:'stale'},
  artifacts:[{id:'art_q4',label:'q4_report_draft.md',freshness:'stale'}],
  evidence:[{id:'ev_1',label:'Evidence 1',freshness:'stale'}],
  agents:[{id:'agent_data',label:'Data Analysis Agent',freshness:'stale'}],
  freshness:{state:'stale',current:false,writable:false},
};

test('active context bar exposes identity evidence and compact freshness status',()=>{
  const html=AGActiveContextBar({context,mode:'chat'});
  assert.match(html,/data-ag-component="active-context"/);
  assert.match(html,/data-context-id="mission_q4"/);
  assert.match(html,/Build Q4 business report/);
  assert.match(html,/1 evidence/);
  assert.match(html,/data-freshness="stale"/);
  assert.match(html,/Stale/);
  assert.doesNotMatch(html,/Connection interrupted/);
});

test('shell CSS keeps connectivity peripheral instead of a fixed overlay',()=>{
  const css=readFileSync(new URL('../styles/shell.css',import.meta.url),'utf8')+readFileSync(new URL('../styles/views.css',import.meta.url),'utf8');
  assert.doesNotMatch(css,/\.ag-connectivity-status\s*\{[^}]*position\s*:\s*fixed/s);
  assert.match(css,/\.ag-active-context-bar/);
});

test('Active Context occupies a real shell row on desktop and mobile',()=>{
  const css=readFileSync(new URL('../styles/views.css',import.meta.url),'utf8');
  assert.match(css,/\.ag-frame\s*\{[^}]*grid-template-rows\s*:\s*62px\s+38px\s+minmax\(0,1fr\)/s);
  assert.match(css,/@media\(max-width:760px\)[\s\S]*\.ag-frame\s*\{[^}]*grid-template-rows\s*:\s*54px\s+38px\s+minmax\(0,1fr\)/s);
  assert.match(css,/\.ag-active-context-strip\s*\{/);
});
