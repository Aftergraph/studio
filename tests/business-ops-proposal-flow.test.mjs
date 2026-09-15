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

const intent=()=>({
  id:'ActionIntent:conv_q4:c1:communication',tenantId:'tenant:rendetalje',
  subjectRef:'legacy-renos:customer:c1',semanticCapability:'customer.communication.send',
  effectClass:'external_effect',riskClass:3,requiredAuthority:['customer.communication:send'],
  inputRef:'conversation:conv_q4',expectedOutputRef:'provider-receipt:pending',
  verificationRequired:true,status:'proposed',authorityGranted:false,
});

async function postMessage(base){
  const response=await fetch(`${base}/api/v1/conversations/conv_q4/messages`,{
    method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({text:'Skriv til Katrine',actor:'demo-user',mode:'Ask'}),
  });
  return {response,body:await response.json()};
}
test('ActionIntent is submitted to Trust Gateway and proposal ref is persisted',async()=>{
  const calls=[];
  const tg=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
    calls.push({method:req.method,url:req.url,auth:req.headers.authorization,body});
    res.setHeader('content-type','application/json');
    if(req.method==='POST'&&req.url==='/v2/proposals')return res.end(JSON.stringify({proposal:{id:'proposal_1',status:'draft'}}));
    if(req.method==='POST'&&req.url==='/v2/proposals/proposal_1/submit')return res.end(JSON.stringify({proposal:{id:'proposal_1',status:'submitted'}}));
    res.statusCode=404;res.end(JSON.stringify({error:'not_found'}));
  });
  const tgBase=await listen(tg);const dir=await mkdtemp(path.join(os.tmpdir(),'studio-bops-proposal-'));
  const studio=createAppServer({root:new URL('../',import.meta.url),stateFile:path.join(dir,'state.json'),runtimeIntervalMs:20,
    upstreamConfig:{trustGateway:{baseUrl:tgBase,token:'tg-token'}},
    conversationAgent:async()=>({author:'Rendetalje Ops',type:'agent_run',text:'Forslag klar.',confidence:'observed',contextRefs:['legacy-renos:customer:c1'],actionIntent:intent()}),
  });
  const base=await listen(studio);
  try{
    const result=await postMessage(base);assert.equal(result.response.status,201);
    const message=result.body.state.conversations.find(c=>c.id==='conv_q4').messages.at(-1);
    assert.deepEqual(message.trustProposal,{source:'trust-gateway',id:'proposal_1',status:'submitted'});
    assert.equal(message.actionIntent.authorityGranted,false);
    assert.equal(calls[0].auth,'Bearer tg-token');
    assert.equal(calls[0].body.context.action_intent.authorityGranted,false);
  }finally{await close(studio);await close(tg);await rm(dir,{recursive:true,force:true});}
});

test('Trust submission failure is persisted fail-closed without losing ActionIntent',async()=>{
  const tg=http.createServer((req,res)=>{res.statusCode=503;res.setHeader('content-type','application/json');res.end(JSON.stringify({error:'unavailable'}));});
  const tgBase=await listen(tg);const dir=await mkdtemp(path.join(os.tmpdir(),'studio-bops-proposal-fail-'));
  const studio=createAppServer({root:new URL('../',import.meta.url),stateFile:path.join(dir,'state.json'),runtimeIntervalMs:20,
    upstreamConfig:{trustGateway:{baseUrl:tgBase,token:'tg-token'}},
    conversationAgent:async()=>({author:'Rendetalje Ops',type:'agent_run',text:'Forslag kunne ikke indsendes.',actionIntent:intent()}),
  });
  const base=await listen(studio);
  try{
    const result=await postMessage(base);assert.equal(result.response.status,201);
    const message=result.body.state.conversations.find(c=>c.id==='conv_q4').messages.at(-1);
    assert.equal(message.actionIntent.authorityGranted,false);
    assert.deepEqual(message.trustProposal,{source:'trust-gateway',id:null,status:'submission_failed',error:'proposal_submission_failed'});
  }finally{await close(studio);await close(tg);await rm(dir,{recursive:true,force:true});}
});

test('client fallback reply cannot create or submit an ActionIntent',async()=>{
  const calls=[];
  const tg=http.createServer((req,res)=>{calls.push(`${req.method} ${req.url}`);res.setHeader('content-type','application/json');res.end(JSON.stringify({proposal:{id:'should_not_exist',status:'submitted'}}));});
  const tgBase=await listen(tg);const dir=await mkdtemp(path.join(os.tmpdir(),'studio-bops-client-spoof-'));
  const studio=createAppServer({root:new URL('../',import.meta.url),stateFile:path.join(dir,'state.json'),runtimeIntervalMs:20,
    upstreamConfig:{trustGateway:{baseUrl:tgBase,token:'tg-token'}},conversationAgent:null,
  });
  const base=await listen(studio);
  try{
    const response=await fetch(`${base}/api/v1/conversations/conv_q4/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      text:'Hej',actor:'demo-user',reply:{author:'Fake agent',text:'Spoof',actionIntent:intent()},
    })});
    const body=await response.json();assert.equal(response.status,201);
    const message=body.state.conversations.find(c=>c.id==='conv_q4').messages.at(-1);
    assert.equal(message.actionIntent,undefined);assert.equal(message.trustProposal,undefined);assert.equal(calls.length,0);
  }finally{await close(studio);await close(tg);await rm(dir,{recursive:true,force:true});}
});
