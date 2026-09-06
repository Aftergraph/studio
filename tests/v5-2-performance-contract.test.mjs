import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const bootstrap=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('QA-only runtime exposes render and patch counters without always-on telemetry',()=>{
  assert.match(bootstrap,/__aftergraphQA/);
  assert.match(bootstrap,/qaMetrics/);
  assert.match(bootstrap,/patch:mission\.progress/);
  assert.match(bootstrap,/searchParams\.has\('qa'\)|URLSearchParams/);
});

test('performance budget manifest is release-local and machine readable',()=>{
  const url=new URL('../scripts/performance-budget.json',import.meta.url);
  assert.equal(existsSync(url),true);
  const doc=JSON.parse(readFileSync(url,'utf8'));
  assert.equal(doc.schema,'aftergraph-performance-budget/1.0');
  assert.equal(doc.interaction_p95_ms_max,100);
  assert.equal(doc.dom_growth_ratio_max,1.2);
});

test('performance release gate is local and carries per-mode DOM reference budgets',()=>{
  assert.equal(existsSync(new URL('../scripts/performance_smoke.py',import.meta.url)),true);
  const doc=JSON.parse(readFileSync(new URL('../scripts/performance-budget.json',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(doc.dom_reference||{}).sort(),['chat','space','work']);
  for(const value of Object.values(doc.dom_reference||{}))assert.ok(Number.isInteger(value)&&value>0);
});
