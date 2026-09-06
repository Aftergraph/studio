import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

function send(res,status,body){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))}
async function listen(server){server.listen(0,'127.0.0.1');await once(server,'listening');return `http://127.0.0.1:${server.address().port}`}

async function withSystem(fn){
  const upstreamCalls=[];
  const upstream=http.createServer((req,res)=>{
    upstreamCalls.push(`${req.method} ${req.url}`);
    if(req.url==='/tg/healthz')return send(res,200,{status:'ok'});
    if(req.url==='/tg/v2/whoami')return send(res,200,{name:'atlas',role:'operator',capabilities:['approval.decide']});
    if(req.url==='/tg/v1/approvals')return send(res,200,{approvals:[{id:'apr_remote',status:'pending',tool:'deploy.prod'}]});
    if(req.url==='/tg/v2/need-you/now')return send(res,200,{items:[{id:'need_remote',type:'approval',subject:'Deploy prod'}]});
    if(req.url==='/tg/v1/audit/verify')return send(res,200,{ok:true});
    if(req.url==='/tg/v1/approvals/apr_remote/approve'&&req.method==='POST')return send(res,200,{status:'approved'});
    if(req.url==='/works/healthz')return send(res,200,{status:'ok'});
    if(req.url==='/works/v1/works')return send(res,200,{works:[{id:'wrk_0123456789abcdef0123456789abcdef',state:'RUNNING',objective:'Canonical work'}]});
    if(req.url==='/works/v1/brain/objects?prefix=%2Forg%2Facme%2F')return send(res,200,{objects:[{path:'/org/acme/notes/runtime'}]});
    if(req.url==='/aie/tasks')return send(res,200,{tasks:[{id:'task_remote',state:'working'}]});
    if(req.url==='/wi/healthz')return send(res,200,{status:'ok'});
    if(req.url==='/wi/v1/work-items')return send(res,200,{items:[{id:'wi_remote',status:'APPROVED',source:'github'}]});
    return send(res,404,{error:'not_found'});
  });
  const upstreamBase=await listen(upstream);
  const dir=await mkdtemp(path.join(os.tmpdir(),'aftergraph-polyrepo-'));
  const app=createAppServer({
    root:new URL('../',import.meta.url),stateFile:path.join(dir,'state.json'),runtimeIntervalMs:20,
    upstreamConfig:{
      trustGateway:{baseUrl:`${upstreamBase}/tg`,token:'TG_PRIVATE_TOKEN'},
      works:{baseUrl:`${upstreamBase}/works`,token:'WORKS_PRIVATE_TOKEN',brainPrefix:'/org/acme/'},
      aie:{baseUrl:`${upstreamBase}/aie`},
      workIntelligence:{baseUrl:`${upstreamBase}/wi`,token:'WI_PRIVATE_TOKEN'},
    },
  });
  const appBase=await listen(app);
  try{await fn({appBase,upstreamCalls})}finally{
    app.close();upstream.close();await Promise.all([once(app,'close'),once(upstream,'close')]);await rm(dir,{recursive:true,force:true});
  }
}

async function req(base,path,options={}){const response=await fetch(base+path,options);return {response,body:await response.json()}}

test('GET upstream status exposes exact source provenance but never credentials',async()=>{
  await withSystem(async({appBase})=>{
    const {response,body}=await req(appBase,'/api/v1/upstreams');
    assert.equal(response.status,200);
    assert.equal(body.services.trustGateway.online,true);
    assert.equal(body.services.works.headSha,'3ea1a80494c38f3e422339db6efbf5a7935a48be');
    const text=JSON.stringify(body);
    assert.equal(text.includes('PRIVATE_TOKEN'),false);
  });
});

test('POST upstream sync persists read-only projections in workspace state',async()=>{
  await withSystem(async({appBase,upstreamCalls})=>{
    upstreamCalls.length=0;
    const sync=await req(appBase,'/api/v1/upstreams/sync',{method:'POST'});
    assert.equal(sync.response.status,200);
    assert.equal(sync.body.upstreams.trustGateway.approvals[0].id,'apr_remote');
    assert.equal(sync.body.upstreams.works.works[0].state,'RUNNING');
    assert.equal(sync.body.upstreams.aie.tasks[0].id,'task_remote');
    assert.equal(sync.body.upstreams.workIntelligence.workItems[0].id,'wi_remote');
    assert.equal(upstreamCalls.some(call=>call.startsWith('POST ')),false,'sync must remain read-only upstream');
    const state=await req(appBase,'/api/v1/state');
    assert.equal(state.body.state.upstreams.workIntelligence.workItems[0].source,'github');
  });
});

test('TG approval proxy is explicit and delegates the consequential write to Trust Gateway',async()=>{
  await withSystem(async({appBase,upstreamCalls})=>{
    upstreamCalls.length=0;
    const result=await req(appBase,'/api/v1/upstreams/trust-gateway/approvals/apr_remote/decision',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({decision:'approve'})});
    assert.equal(result.response.status,200);
    assert.equal(result.body.result.status,'approved');
    assert.ok(upstreamCalls.includes('POST /tg/v1/approvals/apr_remote/approve'));
  });
});

test('WI promotion proxy fails closed without explicit confirmation and human actor',async()=>{
  await withSystem(async({appBase})=>{
    const result=await req(appBase,'/api/v1/upstreams/work-intelligence/wi_remote/promote',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({actor:'jonas'})});
    assert.equal(result.response.status,422);
    assert.equal(result.body.error,'explicit_confirmation_required');
  });
});
