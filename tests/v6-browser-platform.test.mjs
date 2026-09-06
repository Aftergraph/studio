import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { DOMAINS, domainForObject, resolveDomain } from '../src/domain.mjs';
import { PRIMARY_NAV, commandDomainEntries } from '../src/workspace-shell.mjs';
import { createAppServer } from '../server/app-server.mjs';

function federationFixture(){
  const object={graphId:'isr:claim:C-017',type:'claim',canonicalId:'C-017',canonicalOwner:'isr',sourceIntegration:'isr',freshness:'current',payload:{title:'Evidence-gated runtime'}};
  return {
    kernel:{
      integrations:()=>[{manifest:{id:'isr',repository:'Aftergraph/intelligence-systems-research',repositoryRevision:'abc123'},state:'current',freshness:'current',detail:null}],
      objects:()=>[object],
      object:id=>id===object.graphId?object:null,
      discoverCapabilities:q=>String(q).includes('research')?[{id:'research.inspect',sourceIntegration:'isr',granted:false}]:[],
    },
    search:(q)=>({query:q,complete:true,unavailable:[],results:q?[object]:[]}),
    now:()=>({activeWork:[],needsYou:[],research:[object],incidents:[],outcomes:[],coverage:{complete:true,unavailable:[]}}),
  };
}

async function withAppServer(options,fn){
  const server=createAppServer({runtimeIntervalMs:60_000,...options});
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{await fn(`http://127.0.0.1:${server.address().port}`)}finally{server.close();await once(server,'close')}
}

test('V6 contextual domains register research and capabilities without changing Chat Work Space primary navigation',()=>{
  assert.deepEqual(PRIMARY_NAV.map(item=>item.id),['chat','work','space']);
  const ids=DOMAINS.map(domain=>domain.id);
  assert.equal(ids.includes('research'),true);
  assert.equal(ids.includes('capabilities'),true);
  assert.equal(commandDomainEntries().some(item=>item.domain==='research'),true);
  assert.equal(commandDomainEntries().some(item=>item.domain==='capabilities'),true);
  assert.equal(resolveDomain('research'),'research');
  assert.equal(domainForObject('claim'),'research');
  assert.equal(domainForObject('study'),'research');
  assert.equal(domainForObject('capability'),'capabilities');
  assert.equal(domainForObject('skill'),'capabilities');
});

test('real app server mounts injected federation API read surfaces',async()=>{
  await withAppServer({federation:federationFixture()},async base=>{
    const integrations=await fetch(`${base}/api/v1/federation/integrations`);
    assert.equal(integrations.status,200);
    const body=await integrations.json();
    assert.equal(body.integrations[0].manifest.id,'isr');

    const now=await fetch(`${base}/api/v1/federation/now`);
    assert.equal(now.status,200);
    assert.equal((await now.json()).now.research[0].graphId,'isr:claim:C-017');
  });
});

test('app server federation surface remains absent when federation is not configured',async()=>{
  await withAppServer({},async base=>{
    const response=await fetch(`${base}/api/v1/federation/integrations`);
    assert.equal(response.status,404);
  });
});
