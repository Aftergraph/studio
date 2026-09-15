import test from 'node:test';
import assert from 'node:assert/strict';
import { createAftergraphGenerativeRegistry } from '../src/genui/aftergraph-registry.mjs';
import { renderGeneratedNode } from '../src/genui/component-registry.mjs';

test('Aftergraph registry exposes a small first-party vocabulary across execution evidence analysis and output',()=>{
  const registry=createAftergraphGenerativeRegistry();
  for(const id of ['WorkSummary','EvidenceList','MetricTable','ArtifactPreview','ActionProposal']) assert.equal(registry.has(id),true,id);
  assert.ok(registry.size<=10,'initial model vocabulary should stay deliberately small');
});

test('registered renderers escape generated text and preserve inspectable object refs',()=>{
  const registry=createAftergraphGenerativeRegistry();
  const result=renderGeneratedNode({registry,node:{componentId:'EvidenceList',version:'1.0.0',instanceId:'ev_1',props:{title:'Evidence <script>',items:[{id:'ev_1',label:'Build <b>pass</b>',state:'verified'}]}},context:{surface:'chat',contextId:'ctx_q4',freshness:'current'}});
  assert.equal(result.ok,true);
  assert.match(result.html,/Evidence &lt;script&gt;/);
  assert.match(result.html,/data-object-ref="evidence:ev_1"/);
  assert.doesNotMatch(result.html,/<script>|<b>pass<\/b>/);
});

test('ActionProposal is current-state gated and does not encode an endpoint',()=>{
  const registry=createAftergraphGenerativeRegistry();
  const result=renderGeneratedNode({registry,node:{componentId:'ActionProposal',version:'1.0.0',props:{title:'Prepare deployment',detail:'Prepare only',action:'prepare-release',targetId:'mission_release'}},context:{surface:'chat',contextId:'ctx_release',freshness:'stale'}});
  assert.equal(result.interactionClass,'command');
  assert.equal(result.blocked,true);
  assert.match(result.html,/data-generated-action="prepare-release"/);
  assert.match(result.html,/disabled/);
  assert.doesNotMatch(result.html,/https?:|\/api\//);
});

test('ActionProposal carries an explicit typed target reference for governed handoff',()=>{
  const registry=createAftergraphGenerativeRegistry();
  const result=renderGeneratedNode({registry,node:{componentId:'ActionProposal',version:'1.0.0',props:{title:'Prepare release',detail:'Prepare only.',action:'release.prepare',targetType:'mission',targetId:'mission_q4'}},context:{surface:'chat',contextId:'mission_q4',freshness:'current'}});
  assert.match(result.html,/data-target-ref="mission:mission_q4"/);
});
