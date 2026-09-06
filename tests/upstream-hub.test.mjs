import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createUpstreamHub, UPSTREAM_REVISIONS } from '../src/integrations/upstream-hub.mjs';

async function withServer(handler, fn) {
  const server=http.createServer(handler);server.listen(0,'127.0.0.1');await once(server,'listening');
  try{return await fn(`http://127.0.0.1:${server.address().port}`)}finally{server.close();await once(server,'close')}
}
function json(res,status,body){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))}
const calls=[];
function handler(req,res){
  calls.push(`${req.method} ${req.url}`);
  const u=req.url;
  if(u==='/tg/healthz') return json(res,200,{status:'ok'});
  if(u==='/tg/v2/whoami') return json(res,200,{name:'atlas',role:'operator',capabilities:['approval.decide']});
  if(u==='/tg/v1/approvals') return json(res,200,{approvals:[{id:'apr_up',status:'pending',tool:'deploy.prod'}]});
  if(u==='/tg/v2/need-you/now') return json(res,200,{items:[{id:'need_up',type:'approval',subject:'Deploy'}]});
  if(u==='/tg/v1/audit/verify') return json(res,200,{ok:true});
  if(u==='/tg/v1/approvals/apr_up/approve'&&req.method==='POST') return json(res,200,{status:'approved'});

  if(u==='/works/healthz') return json(res,200,{status:'ok'});
  if(u==='/works/v1/works') return json(res,200,{works:[{id:'wrk_0123456789abcdef0123456789abcdef',state:'RUNNING',objective:'Real work'}]});
  if(u==='/works/v1/brain/objects?prefix=%2Forg%2Facme%2F') return json(res,200,{objects:[{path:'/org/acme/notes/live',class:'mutable_with_revision'}]});
  if(u==='/works/v1/works/wrk_0123456789abcdef0123456789abcdef/suspend'&&req.method==='POST') return json(res,200,{state:'WAITING_HUMAN'});

  if(u==='/aie/tasks') return json(res,200,{tasks:[{id:'task-up',state:'working'}]});
  if(u==='/aie/tasks/task-up:cancel'&&req.method==='POST') return json(res,200,{id:'task-up',state:'canceled'});

  if(u==='/wi/healthz') return json(res,200,{status:'ok'});
  if(u==='/wi/v1/work-items') return json(res,200,{items:[{id:'wi_up',status:'APPROVED',source:'github'}]});
  if(u==='/wi/v1/work-items/wi_up/promote'&&req.method==='POST') return json(res,200,{id:'wi_up',status:'PROMOTED'});
  json(res,404,{error:'not_found'});
}

function config(base){return {
  trustGateway:{baseUrl:`${base}/tg`,token:'TG_SUPER_SECRET'},
  works:{baseUrl:`${base}/works`,token:'WORKS_SUPER_SECRET',brainPrefix:'/org/acme/'},
  aie:{baseUrl:`${base}/aie`},
  workIntelligence:{baseUrl:`${base}/wi`,token:'WI_SUPER_SECRET'},
}}

test('upstream manifest pins exact reviewed heads and semantic roles',()=>{
  assert.equal(UPSTREAM_REVISIONS.trustGateway.sha,'515f8f744ff9b0a14df7398e38693fd3ac7ab667');
  assert.equal(UPSTREAM_REVISIONS.works.sha,'3ea1a80494c38f3e422339db6efbf5a7935a48be');
  assert.equal(UPSTREAM_REVISIONS.aie.sha,'3432834afd80e60009f1252a1801f21feb551b9b');
  assert.equal(UPSTREAM_REVISIONS.workIntelligence.sha,'f5cd61ef02b858bcc31f2bb25a0bb792a3b46eeb');
  assert.equal(UPSTREAM_REVISIONS.governance.sha,'40226ebd03ef4c6f081229cce393b231009f0e18');
  assert.equal(UPSTREAM_REVISIONS.research.sha,'d67354385ea94f45e2dad7e8362621a9dee31b2f');
  assert.equal(UPSTREAM_REVISIONS.workIntelligence.role,'detection/observation/proposal-only');
});

test('sync is read-only across upstreams and returns source-truth projections without credentials',async()=>{
  calls.length=0;
  await withServer(handler,async base=>{
    const hub=createUpstreamHub(config(base));
    const result=await hub.sync();
    assert.equal(result.services.trustGateway.online,true);
    assert.equal(result.services.works.online,true);
    assert.equal(result.services.aie.online,true);
    assert.equal(result.services.workIntelligence.online,true);
    assert.equal(result.trustGateway.approvals[0].id,'apr_up');
    assert.equal(result.works.works[0].state,'RUNNING');
    assert.equal(result.works.brain[0].path,'/org/acme/notes/live');
    assert.equal(result.aie.tasks[0].id,'task-up');
    assert.equal(result.workIntelligence.workItems[0].id,'wi_up');
    assert.equal(calls.some(call=>/POST .*promote|POST .*cancel|POST .*approve/.test(call)),false,'sync must never perform consequential writes');
    const serialized=JSON.stringify(result);
    assert.equal(serialized.includes('SUPER_SECRET'),false,'credentials must never appear in projection');
  });
});

test('consequential operations remain explicit and service-owned',async()=>{
  calls.length=0;
  await withServer(handler,async base=>{
    const hub=createUpstreamHub(config(base));
    assert.equal((await hub.decideTrustGatewayApproval('apr_up','approve')).status,'approved');
    assert.equal((await hub.controlWork('wrk_0123456789abcdef0123456789abcdef','suspend')).state,'WAITING_HUMAN');
    assert.equal((await hub.cancelAieTask('task-up')).state,'canceled');
    await assert.rejects(()=>hub.promoteWorkIntelligence('wi_up',{}),/explicit human actor/);
    assert.equal((await hub.promoteWorkIntelligence('wi_up',{actor:'jonas',confirmed:true})).status,'PROMOTED');
  });
});

test('unconfigured upstreams are represented honestly instead of simulated online',async()=>{
  const hub=createUpstreamHub({});
  const status=await hub.status();
  assert.equal(status.trustGateway.configured,false);
  assert.equal(status.works.configured,false);
  assert.equal(status.aie.configured,false);
  assert.equal(status.workIntelligence.configured,false);
  assert.equal(status.governance.mode,'contract-snapshot');
  assert.equal(status.research.mode,'research-reference');
});
