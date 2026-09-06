import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackendSession } from '../src/runtime/backend-session.mjs';

function fakeApi(){
  let handlers={}; let stateCalls=0;
  return {
    async state(){stateCalls++; return {state:{version:stateCalls,activeDomain:'server-chat'},runtimes:{}}},
    subscribe(onMessage,onError,{onOpen}={}){handlers={onMessage,onError,onOpen}; return ()=>{}},
    handlers:()=>handlers,
    stateCalls:()=>stateCalls,
  };
}

test('SSE open performs full state refetch before current',async()=>{
  const api=fakeApi(),statuses=[],states=[];
  const session=createBackendSession({api,onState:p=>states.push(p),onStatus:s=>statuses.push(s)});
  session.start();
  await api.handlers().onOpen();
  assert.equal(api.stateCalls(),1);
  assert.deepEqual(statuses.slice(-2),['resyncing','current']);
  assert.equal(states.at(-1).state.version,1);
});

test('error makes session stale and reconnect refetches again',async()=>{
  const api=fakeApi(),statuses=[];
  const session=createBackendSession({api,onState:()=>{},onStatus:s=>statuses.push(s)});
  session.start(); await api.handlers().onOpen();
  api.handlers().onError(new Error('disconnect'));
  assert.equal(session.status(),'stale');
  await api.handlers().onOpen();
  assert.equal(api.stateCalls(),2);
  assert.equal(session.status(),'current');
  assert.ok(statuses.includes('stale'));
});

test('live message cannot mark stale session current before refetch',async()=>{
  const api=fakeApi(),states=[];
  const session=createBackendSession({api,onState:p=>states.push(p),onStatus:()=>{}});
  session.start(); api.handlers().onError(new Error('disconnect'));
  api.handlers().onMessage({state:{version:999}});
  assert.equal(states.length,0);
  assert.equal(session.status(),'stale');
});

test('resync reports measured payload bytes and latency budget evidence',async()=>{
  const metrics=[]; let handlers={}; let t=100;
  const api={
    async stateWithMeta(){return {payload:{state:{version:7},runtimes:{}},bytes:321}},
    subscribe(onMessage,onError,{onOpen}={}){handlers={onMessage,onError,onOpen};return ()=>{}},
  };
  const session=createBackendSession({api,onState:()=>{},onStatus:()=>{},onMetric:m=>metrics.push(m),now:()=>{t+=25;return t}});
  session.start(); await handlers.onOpen();
  assert.equal(session.status(),'current');
  assert.equal(metrics.at(-1).name,'state-resync');
  assert.equal(metrics.at(-1).payloadBytes,321);
  assert.equal(metrics.at(-1).latencyMs,25);
  assert.equal(typeof metrics.at(-1).latencyBudgetExceeded,'boolean');
});

test('invalid payload is rejected before it can become current truth',async()=>{
  let handlers={}; const states=[]; const statuses=[];
  const api={
    async stateWithMeta(){return {payload:{state:{version:10,missions:'bad'},runtimes:{}},bytes:100}},
    subscribe(onMessage,onError,{onOpen}={}){handlers={onMessage,onError,onOpen};return ()=>{}},
  };
  const session=createBackendSession({api,onState:p=>states.push(p),onStatus:s=>statuses.push(s),validatePayload:p=>{if(typeof p?.state?.missions!=='object'||Array.isArray(p.state.missions)===false)throw new Error('invalid workspace state missions')}});
  session.start(); const ok=await handlers.onOpen();
  assert.equal(ok,false);
  assert.equal(states.length,0);
  assert.equal(session.status(),'stale');
  assert.deepEqual(statuses.slice(-2),['resyncing','stale']);
});
test('resync timeout exits spinner state into degraded fallback',async()=>{
  let handlers={}; const statuses=[];
  const api={
    stateWithMeta(){return new Promise(()=>{})},
    subscribe(onMessage,onError,{onOpen}={}){handlers={onMessage,onError,onOpen};return ()=>{}},
  };
  const session=createBackendSession({api,onState:()=>{},onStatus:s=>statuses.push(s),resyncPolicy:{timeoutMs:15,latencyBudgetMs:5,maxPayloadBytes:1024}});
  session.start(); const ok=await handlers.onOpen();
  assert.equal(ok,false);
  assert.equal(session.status(),'degraded');
  assert.deepEqual(statuses.slice(-2),['resyncing','degraded']);
});

test('oversized reconnect state is rejected instead of becoming current truth',async()=>{
  let handlers={};
  const api={
    async stateWithMeta(){return {payload:{state:{version:9},runtimes:{}},bytes:2048}},
    subscribe(onMessage,onError,{onOpen}={}){handlers={onMessage,onError,onOpen};return ()=>{}},
  };
  const session=createBackendSession({api,onState:()=>{},onStatus:()=>{},resyncPolicy:{timeoutMs:100,latencyBudgetMs:50,maxPayloadBytes:1024}});
  session.start(); const ok=await handlers.onOpen();
  assert.equal(ok,false);
  assert.equal(session.status(),'degraded');
});
