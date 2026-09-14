import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntentIR, validateIntentIR, classifyTarget, renderIntent, refineIntent } from '../packages/intent-compiler/index.mjs';

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

// === Task 2: Auto-targeting, renderers and intent-preserving refinement ===

test('automation + durable persistence prefers hermes target', () => {
  const ir=createIntentIR({
    source:{text:'run nightly backup check',surface:'compose-mobile'},
    goal:{statement:'Automate nightly backup verification'},
    artifact:{kind:'automation',persistence:'durable'},
  });
  const result=classifyTarget(ir);
  assert.equal(result.target,'aftergraph.hermes');
  assert.ok(result.confidence>0.5);
  assert.ok(Array.isArray(result.reasonCodes));
  assert.ok(Array.isArray(result.alternatives));
});

test('repository task with coding hints prefers codex or claude-code', () => {
  const ir=createIntentIR({
    source:{text:'refactor the auth module in typescript',surface:'compose-mobile'},
    goal:{statement:'Refactor auth module'},
    targetHints:['openai.codex','anthropic.claude-code'],
    artifact:{kind:'task'},
  });
  const result=classifyTarget(ir);
  assert.ok(
    result.target==='openai.codex'||result.target==='anthropic.claude-code',
    `expected codex or claude-code, got ${result.target}`
  );
});

test('no evidence falls back to generic, not fabricated certainty', () => {
  const ir=createIntentIR({
    source:{text:'think about stuff',surface:'compose-mobile'},
    goal:{statement:'Consider things'},
  });
  const result=classifyTarget(ir);
  assert.equal(result.target,'generic');
  assert.ok(result.confidence<=0.5);
});

test('renderer includes constraints and verification sections', () => {
  const ir=createIntentIR({
    source:{text:'audit billing logs',surface:'compose-mobile'},
    goal:{statement:'Audit billing logs for discrepancies'},
    constraints:['Read-only access','Do not modify records'],
    verification:{required:true,obligations:['Report findings']},
  });
  const rendered=renderIntent(ir,'generic');
  assert.equal(rendered.target,'generic');
  assert.equal(rendered.mediaType,'text/plain');
  assert.ok(typeof rendered.content==='string');
  assert.ok(rendered.content.includes('Read-only access'));
  assert.ok(rendered.semanticMap.constraints.includes('constraints'));
  assert.ok(rendered.semanticMap.verification.includes('verification'));
});

test('more-autonomous refinement preserves authority byte-equivalent', () => {
  const ir=createIntentIR({
    source:{text:'deploy staging config',surface:'compose-mobile'},
    goal:{statement:'Deploy staging configuration'},
    authority:{read:['staging-config'],write:[],execute:[],network:[],requiresApproval:[]},
  });
  const refined=refineIntent(ir,'more-autonomous','generic');
  assert.equal(refined.error,undefined);
  assert.deepEqual(refined.artifact.authorityBefore,ir.authority);
  assert.deepEqual(refined.artifact.authorityAfter,ir.authority);
  assert.equal(refined.refinement.mode,'more-autonomous');
});

test('safer refinement never adds write or execute authority', () => {
  const ir=createIntentIR({
    source:{text:'update user preferences',surface:'compose-mobile'},
    goal:{statement:'Update user preferences safely'},
    authority:{read:['user-prefs'],write:['user-prefs'],execute:[],network:[],requiresApproval:[]},
  });
  const refined=refineIntent(ir,'safer','generic');
  assert.equal(refined.error,undefined);
  assert.deepEqual(refined.artifact.authorityAfter.write,ir.authority.write);
  assert.deepEqual(refined.artifact.authorityAfter.execute,[]);
});

test('refinement fails closed on authority expansion', () => {
  const ir=createIntentIR({
    source:{text:'check system health',surface:'compose-mobile'},
    goal:{statement:'Check system health'},
    authority:{read:[],write:[],execute:[],network:[],requiresApproval:[]},
  });
  // Simulate a refinement that would expand authority by passing a malicious mode
  // The refineIntent function must detect expansion and reject
  const refined=refineIntent(ir,'execution-ready','generic');
  // execution-ready should NOT add write/execute if original had none
  if(refined.error){
    assert.equal(refined.error,'AUTHORITY_EXPANSION');
  } else {
    assert.deepEqual(refined.artifact.authorityAfter.write,[]);
    assert.deepEqual(refined.artifact.authorityAfter.execute,[]);
  }
});
