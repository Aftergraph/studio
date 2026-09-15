import test from 'node:test';
import assert from 'node:assert/strict';
import { createRendetaljeOpsConversationAgent, rendetaljeOpsConversationAgentFromEnv } from '../server/rendetalje-ops-agent.mjs';

test('Rendetalje Ops adapter posts bounded context with server bearer auth',async()=>{
  let seen;
  const fetchImpl=async(url,options)=>{
    seen={url:String(url),options,body:JSON.parse(options.body)};
    return new Response(JSON.stringify({author:'Rendetalje Ops',type:'agent_run',text:'Observeret svar',confidence:'observed',contextRefs:['legacy:1']}),{status:200,headers:{'content-type':'application/json'}});
  };
  const agent=createRendetaljeOpsConversationAgent({baseUrl:'http://ops.internal',token:'svc-secret',fetchImpl});
  const reply=await agent({conversationId:'conv_1',text:'Hvordan står Katrine?',mode:'Ask',actor:'demo-user',attachments:[],context:{conversation:{id:'conv_1',title:'Ops',messages:['secret-history']},mission:{id:'m1',title:'Follow up',state:'running'},memory:['do-not-send'],permissions:['approval.decide']}});
  assert.equal(reply.text,'Observeret svar');
  assert.equal(seen.options.headers.authorization,'Bearer svc-secret');
  assert.deepEqual(seen.body.context,{conversation:{id:'conv_1',title:'Ops'},mission:{id:'m1',title:'Follow up',state:'running'}});
});
test('Rendetalje Ops adapter fails safe without fabricating authority',async()=>{
  const agent=createRendetaljeOpsConversationAgent({
    baseUrl:'http://ops.internal',token:'svc-secret',
    fetchImpl:async()=>new Response(JSON.stringify({error:'agent_unavailable'}),{status:502,headers:{'content-type':'application/json'}}),
  });
  const reply=await agent({conversationId:'conv_1',text:'Send besked',mode:'Ask',actor:'demo-user',attachments:[],context:{}});
  assert.equal(reply.author,'Rendetalje Ops');
  assert.match(reply.text,/midlertidigt utilgængelig/i);
  assert.equal(reply.actionIntent,undefined);
});

test('env factory is disabled when absent and rejects partial configuration',()=>{
  assert.equal(rendetaljeOpsConversationAgentFromEnv({}),null);
  assert.throws(()=>rendetaljeOpsConversationAgentFromEnv({AFTERGRAPH_RENDETALJE_OPS_URL:'http://ops'}),/rendetalje_ops_config_incomplete/);
});
