import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntentIR, validateIntentIR } from '../packages/intent-compiler/index.mjs';

test('creates canonical v0.1 intent with explicit empty authority', () => {
  const ir=createIntentIR({
    source:{text:'review relay but do not change anything',surface:'compose-mobile'},
    goal:{statement:'Review Relay for remaining gaps'},
    constraints:['Do not modify source'],
  });
  assert.equal(ir.schema,'aftergraph/intent-ir/v0.1');
  assert.deepEqual(ir.authority,{read:[],write:[],execute:[],network:[],requiresApproval:[]});
  assert.equal(ir.source.text,'review relay but do not change anything');
  assert.equal(validateIntentIR(ir).ok,true);
});

test('never invents write authority', () => {
  const ir=createIntentIR({
    source:{text:'fix it',surface:'compose-mobile'},
    goal:{statement:'Fix the identified issue'},
  });
  assert.deepEqual(ir.authority.write,[]);
  assert.deepEqual(ir.authority.execute,[]);
});

test('material ambiguity remains visible', () => {
  const ir=createIntentIR({
    source:{text:'make this permanent maybe',surface:'compose-mobile'},
    goal:{statement:'Preserve a behavior'},
    ambiguities:['Persistence is unclear'],
  });
  assert.deepEqual(ir.ambiguities,['Persistence is unclear']);
});
