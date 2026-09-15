import test from 'node:test';
import assert from 'node:assert/strict';
import { createAftergraphGenerativeRegistry } from '../src/genui/aftergraph-registry.mjs';
import { renderGeneratedMessageSurfaces } from '../src/genui/chat-surface.mjs';

const registry=createAftergraphGenerativeRegistry();
const context={surface:'chat',contextId:'ctx_q4',freshness:'current'};

test('Chat renders generated durable surfaces only through the governed registry',()=>{
  const html=renderGeneratedMessageSurfaces({registry,context,message:{id:'msg_gen',generatedUI:[
    {componentId:'WorkSummary',version:'1.0.0',instanceId:'surface_1',props:{title:'Q4 report',state:'running',progress:65,agent:'Data Analysis Agent',evidenceCount:4}},
  ]}});
  assert.match(html,/data-genui-instance="surface_1"/);
  assert.match(html,/data-generated-component="WorkSummary"/);
  assert.match(html,/Q4 report/);
});

test('unknown generated components become safe structured fallbacks, never raw markup',()=>{
  const html=renderGeneratedMessageSurfaces({registry,context,message:{id:'msg_bad',generatedUI:[
    {componentId:'iframe',version:'1.0.0',props:{html:'<script>alert(1)<\/script>'}},
  ]}});
  assert.match(html,/data-genui-error="unknown_component"/);
  assert.match(html,/Structured response unavailable/);
  const lowered=html.toLowerCase();
  assert.equal(lowered.includes('<script'),false);
  assert.equal(lowered.includes('<iframe'),false);
});

test('stale command surfaces remain visible but disabled in Chat',()=>{
  const html=renderGeneratedMessageSurfaces({registry,context:{...context,freshness:'stale'},message:{id:'msg_action',generatedUI:[
    {componentId:'ActionProposal',version:'1.0.0',instanceId:'action_1',props:{title:'Prepare deploy',detail:'Prepare release action',action:'prepare-release',targetId:'mission_release'}},
  ]}});
  assert.match(html,/data-genui-blocked="true"/);
  assert.match(html,/disabled/);
  assert.match(html,/Prepare deploy/);
});

test('generated surfaces retain message/node identity and render prepared interaction state',()=>{
  const html=renderGeneratedMessageSurfaces({registry,context:{...context,interactionStates:{action_2:{status:'prepared',authority:{status:'pending'}}}},message:{id:'msg_action_ready',generatedUI:[
    {componentId:'ActionProposal',version:'1.0.0',instanceId:'action_2',props:{title:'Prepare release',detail:'Prepare only',action:'release.prepare',targetType:'mission',targetId:'mission_q4'}},
  ]}});
  assert.match(html,/data-genui-message-id="msg_action_ready"/);
  assert.match(html,/data-genui-index="0"/);
  assert.match(html,/Prepared/);
  assert.match(html,/Authority pending/);
});
