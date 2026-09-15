import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGenerativeRegistry,
  createStrictSchema,
  validateGeneratedNode,
  renderGeneratedNode,
  AGGenUIError,
} from '../src/genui/component-registry.mjs';

const schema=createStrictSchema({
  title:{type:'string',required:true},
  count:{type:'number',required:true},
});

const component={
  id:'EvidenceSummary',version:'1.0.0',schema,
  allowedContexts:['chat','work'],interactionClass:'read',
  requiredCapabilities:[],freshnessPolicy:'allow-stale',authorityPolicy:'none',evidencePolicy:'inspectable',
  render:props=>`<section><strong>${props.title}</strong><span>${props.count}</span></section>`,
};

function registry(){return createGenerativeRegistry({components:[component]})}

test('registry is finite, immutable and rejects duplicate component identities',()=>{
  const r=registry();
  assert.equal(r.size,1);
  assert.ok(Object.isFrozen(r.components));
  assert.equal(r.get('EvidenceSummary').version,'1.0.0');
  assert.throws(()=>createGenerativeRegistry({components:[component,component]}),AGGenUIError);
});

test('unknown generated components fail closed instead of becoming DOM tags',()=>{
  const r=registry();
  assert.throws(()=>validateGeneratedNode({registry:r,node:{componentId:'script',version:'1.0.0',props:{}},context:{surface:'chat'}}),error=>error.code==='unknown_component');
});

test('strict schemas reject missing, mistyped and unknown props',()=>{
  const r=registry();
  const base={componentId:'EvidenceSummary',version:'1.0.0'};
  assert.throws(()=>validateGeneratedNode({registry:r,node:{...base,props:{title:'Evidence'}},context:{surface:'chat'}}),error=>error.code==='schema_invalid');
  assert.throws(()=>validateGeneratedNode({registry:r,node:{...base,props:{title:'Evidence',count:'4'}},context:{surface:'chat'}}),error=>error.code==='schema_invalid');
  assert.throws(()=>validateGeneratedNode({registry:r,node:{...base,props:{title:'Evidence',count:4,onClick:'deploy'}},context:{surface:'chat'}}),error=>error.code==='schema_invalid');
});

test('generated payload cannot widen interaction class or escape allowed surface',()=>{
  const r=registry();
  const base={componentId:'EvidenceSummary',version:'1.0.0',props:{title:'Evidence',count:4}};
  assert.throws(()=>validateGeneratedNode({registry:r,node:{...base,interactionClass:'consequential'},context:{surface:'chat'}}),error=>error.code==='interaction_class_override');
  assert.throws(()=>validateGeneratedNode({registry:r,node:base,context:{surface:'space'}}),error=>error.code==='context_not_allowed');
});

test('safe renderer renders only the registered renderer with normalized metadata',()=>{
  const result=renderGeneratedNode({
    registry:registry(),
    node:{componentId:'EvidenceSummary',version:'1.0.0',instanceId:'gen_1',props:{title:'Evidence',count:4}},
    context:{surface:'chat',contextId:'ctx_1',freshness:'current'},
  });
  assert.equal(result.ok,true);
  assert.equal(result.componentId,'EvidenceSummary');
  assert.equal(result.interactionClass,'read');
  assert.equal(result.instanceId,'gen_1');
  assert.match(result.html,/Evidence/);
  assert.doesNotMatch(result.html,/script/i);
});

test('current-only components remain visible but blocked when context is stale',()=>{
  const guarded={...component,id:'ActionProposal',interactionClass:'command',freshnessPolicy:'current-required'};
  const r=createGenerativeRegistry({components:[guarded]});
  const result=renderGeneratedNode({registry:r,node:{componentId:'ActionProposal',version:'1.0.0',props:{title:'Deploy',count:1}},context:{surface:'chat',contextId:'ctx_1',freshness:'stale'}});
  assert.equal(result.ok,true);
  assert.equal(result.blocked,true);
  assert.equal(result.blockReason,'freshness_required');
  assert.match(result.html,/Deploy/);
});
