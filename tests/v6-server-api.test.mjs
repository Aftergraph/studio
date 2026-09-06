import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { createFederationApiHandler } from '../server/federation-routes.mjs';
import { createFederationBrowserClient } from '../src/federation/browser-client.mjs';
function kernel(){return {integrations:()=>[{manifest:{id:'works',repository:'Aftergraph/works-execution'},state:'current',freshness:'current',detail:null}],objects:()=>[{graphId:'works:work:w1',type:'work',canonicalId:'w1',canonicalOwner:'works',sourceIntegration:'works',freshness:'current',payload:{title:'Deploy'}}],object:id=>id==='works:work:w1'?{graphId:id,type:'work',canonicalId:'w1',canonicalOwner:'works',sourceIntegration:'works',freshness:'current',payload:{title:'Deploy'}}:null,discoverCapabilities:q=>q?[]:[],surfacesForObject:()=>[]}}
async function withServer(fn){const handler=createFederationApiHandler({kernel:kernel(),search:(q,opts)=>({query:q,complete:true,unavailable:[],results:q==='deploy'?[{graphId:'works:work:w1',sourceIntegration:'works',freshness:'current'}]:[]}),now:()=>({activeWork:[{graphId:'works:work:w1'}],coverage:{complete:true,unavailable:[]}})});const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://127.0.0.1');if(!handler(req,res,url)){res.writeHead(404,{'content-type':'application/json'});res.end('{"error":"not_found"}')}});server.listen(0,'127.0.0.1');await once(server,'listening');try{await fn(`http://127.0.0.1:${server.address().port}`)}finally{server.close();await once(server,'close')}}
test('federation API exposes integration health without credentials',async()=>withServer(async base=>{const r=await fetch(`${base}/api/v1/federation/integrations`);assert.equal(r.status,200);const j=await r.json();assert.equal(j.integrations[0].manifest.id,'works');assert.equal(JSON.stringify(j).includes('token'),false)}));
test('federation object endpoint preserves graph identity and owner',async()=>withServer(async base=>{const r=await fetch(`${base}/api/v1/federation/objects/${encodeURIComponent('works:work:w1')}`);const j=await r.json();assert.equal(j.object.graphId,'works:work:w1');assert.equal(j.object.canonicalOwner,'works')}));
test('federated search API reports coverage',async()=>withServer(async base=>{const r=await fetch(`${base}/api/v1/federation/search?q=deploy&tenantId=t1`);const j=await r.json();assert.equal(j.search.complete,true);assert.equal(j.search.results[0].graphId,'works:work:w1')}));
test('browser client uses same-origin federation routes',async()=>withServer(async base=>{const c=createFederationBrowserClient({baseUrl:base});assert.equal((await c.integrations()).integrations[0].manifest.id,'works');assert.equal((await c.object('works:work:w1')).object.canonicalOwner,'works');assert.equal((await c.search('deploy',{tenantId:'t1'})).search.results.length,1)}));
test('unknown federation object returns 404',async()=>withServer(async base=>{const r=await fetch(`${base}/api/v1/federation/objects/${encodeURIComponent('works:work:nope')}`);assert.equal(r.status,404)}));

test('intent resolve opens a journey without granting', async () => withServer(async (base) => {
  const { createFederationKernel } = await import('../src/federation/federation-kernel.mjs');
  const { createFederationApiHandler: mkHandler } = await import('../server/federation-routes.mjs');
  const k = createFederationKernel();
  const h = mkHandler({ kernel: k });
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!h(req, res, url)) { res.writeHead(404); res.end('{}'); }
  });
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  try {
    const b = `http://127.0.0.1:${srv.address().port}`;
    const r = await fetch(`${b}/api/v1/federation/intent/resolve`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: 'research this', mode: 'Ask', subjectId: 'human:1', actor: 'human:1' }),
    });
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.journey.stage, 'resolved');
    assert.equal(j.journey.authority, 'none');
    assert.equal(j.journey.executed, false);
  } finally { srv.close(); await once(srv, 'close'); }
}));

test('workspace compose returns typed plan without markup', async () => {
  const { createFederationKernel } = await import('../src/federation/federation-kernel.mjs');
  const { createFederationApiHandler: mkHandler } = await import('../server/federation-routes.mjs');
  const k = createFederationKernel();
  k.registerSurface({ id: 'mission-detail', sourceIntegration: 'works', objectTypes: ['mission'] });
  k.registerSurface({ id: 'approval-gate', sourceIntegration: 'studio', objectTypes: [] });
  const h = mkHandler({ kernel: k });
  const srv = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!h(req, res, url)) { res.writeHead(404); res.end('{}'); }
  });
  srv.listen(0, '127.0.0.1');
  await once(srv, 'listening');
  try {
    const b = `http://127.0.0.1:${srv.address().port}`;
    const r = await fetch(`${b}/api/v1/federation/workspace/compose?objectType=mission&journeyStage=approved`);
    assert.equal(r.status, 200);
    const j = await r.json();
    assert.equal(j.ok, true);
    assert.equal(j.plan.surfaces[0].kind, 'approval-gate');
    assert.ok(!JSON.stringify(j.plan).includes('<'));
  } finally { srv.close(); await once(srv, 'close'); }
});
