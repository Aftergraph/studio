import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';
import { SQLiteExperienceStore } from '../src/persistence/sqlite-experience-store.mjs';

async function listen(server){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  return `http://127.0.0.1:${server.address().port}`;
}
async function json(url,options){
  const response=await fetch(url,options);
  const body=await response.json();
  return {response,body};
}
const document=()=>({layout:{mode:'chat'},preferences:{density:'calm'}});

test('experience route is unavailable without store and tenant binding provider',async()=>{
  const server=createAppServer({root:new URL('../',import.meta.url)});
  const base=await listen(server);
  try{
    const read=await json(`${base}/api/v1/experience`);
    assert.equal(read.response.status,503);
    assert.equal(read.body.error,'experience_unavailable');
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('experience route fails closed when tenant binding is unavailable',async()=>{
  const store=await new SQLiteExperienceStore().init();
  const server=createAppServer({root:new URL('../',import.meta.url),experienceStore:store,tenantBindingProvider:async()=>null});
  const base=await listen(server);
  try{
    const read=await json(`${base}/api/v1/experience`);
    assert.equal(read.response.status,503);
    assert.equal(read.body.error,'tenant_binding_unavailable');
  }finally{await new Promise(resolve=>server.close(resolve));await store.close();}
});
test('tenant-bound experience route reads writes and returns deltas',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ag-exp-route-'));
  const store=await new SQLiteExperienceStore({filename:path.join(dir,'experience.db')}).init();
  const server=createAppServer({
    root:new URL('../',import.meta.url),experienceStore:store,
    tenantBindingProvider:async()=>({tenantId:'tenant:acme'}),
  });
  const base=await listen(server);
  try{
    let read=await json(`${base}/api/v1/experience`);
    assert.equal(read.response.status,200);
    assert.equal(read.body.tenantId,'tenant:acme');
    assert.equal(read.body.version,0);
    const write=await json(`${base}/api/v1/experience`,{
      method:'PUT',headers:{'content-type':'application/json','idempotency-key':'route-1'},
      body:JSON.stringify({expectedVersion:0,document:document()}),
    });
    assert.equal(write.response.status,200);
    assert.equal(write.body.version,1);
    assert.equal(write.body.document.tenantId,'tenant:acme');
    read=await json(`${base}/api/v1/experience/events?after=0&limit=10`);
    assert.equal(read.response.status,200);
    assert.deepEqual(read.body.events.map(event=>event.sequence),[1]);
  }finally{await new Promise(resolve=>server.close(resolve));await store.close();await rm(dir,{recursive:true,force:true});}
});test('experience route maps stale version and idempotency conflicts to 409',async()=>{
  const store=await new SQLiteExperienceStore().init();
  const server=createAppServer({
    root:new URL('../',import.meta.url),experienceStore:store,
    tenantBindingProvider:async()=>({tenantId:'tenant:acme'}),
  });
  const base=await listen(server);
  try{
    const first=await json(`${base}/api/v1/experience`,{
      method:'PUT',headers:{'content-type':'application/json','idempotency-key':'route-conflict'},
      body:JSON.stringify({expectedVersion:0,document:document()}),
    });
    assert.equal(first.response.status,200);
    const stale=await json(`${base}/api/v1/experience`,{
      method:'PUT',headers:{'content-type':'application/json','idempotency-key':'route-stale'},
      body:JSON.stringify({expectedVersion:0,document:document()}),
    });
    assert.equal(stale.response.status,409);
    assert.equal(stale.body.error,'version_conflict');
    const reused=await json(`${base}/api/v1/experience`,{
      method:'PUT',headers:{'content-type':'application/json','idempotency-key':'route-conflict'},
      body:JSON.stringify({expectedVersion:1,document:{layout:{mode:'work'}}}),
    });
    assert.equal(reused.response.status,409);
    assert.equal(reused.body.error,'idempotency_conflict');
  }finally{await new Promise(resolve=>server.close(resolve));await store.close();}
});
