import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source=readFileSync(new URL('../src/app/bootstrap.mjs',import.meta.url),'utf8');

test('Studio shell renders persistent Active Context from canonical workspace state',()=>{
  assert.match(source,/deriveActiveContext\(state,ui,/);
  assert.match(source,/AGActiveContextBar\(\{context[,}]/);
  assert.match(source,/ag-active-context-strip/);
});

test('human mode navigation aligns view selection to Active Context',()=>{
  assert.match(source,/alignModeToActiveContext\(state,ui,id\)/);
  assert.match(source,/conversationIdForMission\(state,/);
});

test('backend phase changes patch Active Context freshness without forcing a full shell render',()=>{
  assert.match(source,/function refreshActiveContextStrip\(\)/);
  assert.match(source,/setBackendPhase\(phase\)[\s\S]*refreshActiveContextStrip\(\)/);
  assert.match(source,/host\.innerHTML=AGActiveContextBar/);
});
