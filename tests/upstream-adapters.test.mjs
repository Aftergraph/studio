import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createTrustGatewayAdapter } from '../src/integrations/trust-gateway.mjs';
import { createWorksAdapter } from '../src/integrations/works.mjs';
import { createAieAdapter } from '../src/integrations/aie.mjs';
import { createWorkIntelligenceAdapter } from '../src/integrations/work-intelligence.mjs';
import { createGovernanceAdapter } from '../src/integrations/governance.mjs';

async function withServer(handler, fn) {
  const server=http.createServer(handler);
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  const {port}=server.address();
  try { return await fn(`http://127.0.0.1:${port}`); }
  finally { server.close(); await once(server,'close'); }
}

function json(res,status,body){res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(body))}

const requests=[];
function contractServer(req,res){
  requests.push({method:req.method,url:req.url,authorization:req.headers.authorization});
  if(req.url==='/healthz') return json(res,200,{status:'ok'});
  if(req.url==='/v2/whoami') return json(res,200,{name:'atlas',role:'operator',capabilities:['approval.decide']});
  if(req.url==='/v1/approvals'&&req.method==='GET') return json(res,200,{approvals:[{id:'apr_1',status:'pending'}]});
  if(req.url==='/v1/approvals/apr_1/approve'&&req.method==='POST') return json(res,200,{status:'approved'});
  if(req.url==='/v2/need-you/now') return json(res,200,{items:[{id:'need_1',type:'approval'}]});
  if(req.url==='/v1/audit/verify') return json(res,200,{ok:true,head:'abc'});

  if(req.url==='/v1/works'&&req.method==='GET') return json(res,200,{works:[{id:'wrk_0123456789abcdef0123456789abcdef',state:'RUNNING'}]});
  if(req.url==='/v1/works/wrk_0123456789abcdef0123456789abcdef') return json(res,200,{work:{id:'wrk_0123456789abcdef0123456789abcdef',state:'RUNNING'}});
  if(req.url==='/v1/works/wrk_0123456789abcdef0123456789abcdef/events?after=0&limit=100') return json(res,200,{events:[{seq:1,type:'work.state.changed'}]});
  if(req.url==='/v1/works/wrk_0123456789abcdef0123456789abcdef/evidence') return json(res,200,{evidence:[{id:'ev_1'}]});
  if(req.url==='/v1/works/wrk_0123456789abcdef0123456789abcdef/suspend'&&req.method==='POST') return json(res,200,{state:'WAITING_HUMAN',checkpoint_hash:'h1'});
  if(req.url==='/v1/brain/objects?prefix=%2Forg%2Facme%2F') return json(res,200,{objects:[{path:'/org/acme/notes/x'}]});

  if(req.url==='/tasks'&&req.method==='GET') return json(res,200,{tasks:[{id:'task-1'}]});
  if(req.url==='/tasks/task-1'&&req.method==='GET') return json(res,200,{id:'task-1',state:'working'});
  if(req.url==='/tasks/task-1:cancel'&&req.method==='POST') return json(res,200,{id:'task-1',state:'canceled'});
  if(req.url==='/message:send'&&req.method==='POST') return json(res,200,{task:{id:'task-2'}});

  if(req.url==='/v1/work-items'&&req.method==='GET') return json(res,200,{items:[{id:'wi_1',status:'APPROVED',source:'github'}]});
  if(req.url==='/v1/work-items/wi_1/evidence') return json(res,200,{evidence:{hmac:'x'}});
  if(req.url==='/v1/work-items/wi_1/review'&&req.method==='POST') return json(res,200,{id:'wi_1',status:'APPROVED'});
  if(req.url==='/v1/work-items/wi_1/promote'&&req.method==='POST') return json(res,200,{id:'wi_1',status:'PROMOTED'});
  json(res,404,{error:'not_found',path:req.url});
}

test('Trust Gateway adapter follows canonical approval, Needs You, identity and audit surfaces', async()=>{
  requests.length=0;
  await withServer(contractServer,async baseUrl=>{
    const tg=createTrustGatewayAdapter({baseUrl,token:'tg-secret'});
    assert.deepEqual(await tg.identity(),{name:'atlas',role:'operator',capabilities:['approval.decide']});
    assert.equal((await tg.approvals()).approvals.length,1);
    assert.equal((await tg.needsYou()).items[0].id,'need_1');
    assert.equal((await tg.decideApproval('apr_1','approve')).status,'approved');
    assert.equal((await tg.verifyAudit()).ok,true);
    assert.equal(requests.find(r=>r.url==='/v2/whoami').authorization,'Bearer tg-secret');
  });
});

test('WORKS adapter reads durable work, journal, evidence and bridge control surfaces', async()=>{
  await withServer(contractServer,async baseUrl=>{
    const works=createWorksAdapter({baseUrl,token:'works-secret'});
    assert.equal((await works.listWorks()).works[0].state,'RUNNING');
    assert.equal((await works.work('wrk_0123456789abcdef0123456789abcdef')).work.state,'RUNNING');
    assert.equal((await works.events('wrk_0123456789abcdef0123456789abcdef')).events[0].seq,1);
    assert.equal((await works.evidence('wrk_0123456789abcdef0123456789abcdef')).evidence.length,1);
    assert.equal((await works.suspend('wrk_0123456789abcdef0123456789abcdef')).state,'WAITING_HUMAN');
    assert.equal((await works.brainPrefix('/org/acme/')).objects[0].path,'/org/acme/notes/x');
  });
});

test('AIE adapter uses only documented A2A HTTP+JSON operations and requires stable messageId', async()=>{
  await withServer(contractServer,async baseUrl=>{
    const aie=createAieAdapter({baseUrl});
    assert.equal((await aie.tasks()).tasks[0].id,'task-1');
    assert.equal((await aie.task('task-1')).id,'task-1');
    assert.equal((await aie.cancelTask('task-1')).state,'canceled');
    assert.throws(()=>aie.sendMessage({message:{parts:[]}}),/messageId/);
    assert.equal((await aie.sendMessage({message:{messageId:'msg-1',parts:[]}})).task.id,'task-2');
  });
});

test('Work Intelligence adapter exposes detection/review/promotion explicitly and never auto-promotes reads', async()=>{
  requests.length=0;
  await withServer(contractServer,async baseUrl=>{
    const wi=createWorkIntelligenceAdapter({baseUrl,token:'wi-secret'});
    const listed=await wi.workItems();
    assert.equal(listed.items[0].source,'github');
    assert.equal(requests.some(r=>r.url?.includes('/promote')),false,'read path must not auto-promote');
    assert.equal((await wi.evidence('wi_1')).evidence.hmac,'x');
    assert.equal((await wi.review('wi_1',{decision:'approve',actor:'human'})).status,'APPROVED');
    assert.equal((await wi.promote('wi_1',{actor:'human'})).status,'PROMOTED');
  });
});

test('Governance adapter enforces canonical mission transitions and evidence-gated VERIFIED',()=>{
  const gov=createGovernanceAdapter();
  assert.equal(gov.canTransition('RUNNING','VERIFYING'),true);
  assert.equal(gov.canTransition('RUNNING','VERIFIED'),false);
  assert.throws(()=>gov.assertTransition({from:'VERIFYING',to:'VERIFIED',evidence:[]}),/evidence/i);
  assert.doesNotThrow(()=>gov.assertTransition({from:'VERIFYING',to:'VERIFIED',evidence:[{id:'ev'}]}));
});
