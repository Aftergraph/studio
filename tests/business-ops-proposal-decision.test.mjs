import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`;}
async function close(server){server.close();await once(server,'close');}
const mission='wrk_0123456789abcdef0123456789abcdef';
const actionIntent={id:'ActionIntent:1',tenantId:'tenant:rendetalje',subjectRef:'legacy-renos:customer:c1',semanticCapability:'customer.communication.send',effectClass:'external_effect',riskClass:3,requiredAuthority:['customer.communication:send'],inputRef:'conversation:conv_q4',expectedOutputRef:'provider-receipt:pending',verificationRequired:true,status:'proposed',authorityGranted:false};

test('operator approval updates Trust proposal correlation without granting ActionIntent authority',async()=>{
  const calls=[];
  const tg=http.createServer((req,res)=>{
    calls.push(`${req.method} ${req.url}`);res.setHeader('content-type','application/json');
    if(req.url==='/v2/proposals'&&req.method==='POST')return res.end(JSON.stringify({proposal:{id:'proposal_1',status:'draft'}}));
    if(req.url==='/v2/proposals/proposal_1/submit'&&req.method==='POST')return res.end(JSON.stringify({proposal:{id:'proposal_1',status:'submitted'}}));
    if(req.url==='/v2/proposals/proposal_1/approve'&&req.method==='POST')return res.end(JSON.stringify({ok:true,proposal:{id:'proposal_1',status:'approved',converted_to_mission_id:mission},works:{ok:true,work_id:mission}}));
    res.statusCode=404;res.end(JSON.stringify({error:'not_found'}));
  });
  const tgBase=await listen(tg);const dir=await mkdtemp(path.join(os.tmpdir(),'studio-bops-decision-'));
  const studio=createAppServer({root:new URL('../',import.meta.url),stateFile:path.join(dir,'state.json'),runtimeIntervalMs:20,
    upstreamConfig:{trustGateway:{baseUrl:tgBase,token:'tg-token'}},
    conversationAgent:async()=>({author:'Rendetalje Ops',type:'agent_run',text:'Forslag klar.',confidence:'observed',contextRefs:['legacy-renos:customer:c1'],actionIntent}),
  });
  const base=await listen(studio);
  try{
    const messageResponse=await fetch(`${base}/api/v1/conversations/conv_q4/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Skriv til Katrine',actor:'demo-user'})});
    assert.equal(messageResponse.status,201);
    const decisionResponse=await fetch(`${base}/api/v1/upstreams/trust-gateway/proposals/proposal_1/decision`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decision:'approve',actor:'demo-user',confirmed:true})});
    const decisionBody=await decisionResponse.json();
    assert.equal(decisionResponse.status,200);
    const message=decisionBody.state.conversations.find(c=>c.id==='conv_q4').messages.find(m=>m.trustProposal?.id==='proposal_1');
    assert.equal(message.trustProposal.status,'approved');
    assert.equal(message.trustProposal.missionId,mission);
    assert.equal(message.actionIntent.authorityGranted,false);
    assert.ok(calls.includes('POST /v2/proposals/proposal_1/approve'));
  }finally{await close(studio);await close(tg);await rm(dir,{recursive:true,force:true});}
});
