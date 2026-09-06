import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/api-client.mjs';

function fetchStub(routes) {
  return async (url, options={}) => {
    const key = `${options.method||'GET'} ${new URL(url,'http://local').pathname}${new URL(url,'http://local').search}`;
    const route = routes[key];
    if (!route) return new Response(JSON.stringify({error:'not_found'}),{status:404,headers:{'content-type':'application/json'}});
    const body = typeof route.body === 'function' ? route.body(options) : route.body;
    return new Response(JSON.stringify(body),{status:route.status||200,headers:{'content-type':'application/json'}});
  };
}

test('API client detects backend and reads canonical state', async () => {
  const client = createApiClient({ fetchImpl:fetchStub({
    'GET /healthz':{body:{status:'ok'}},
    'GET /api/v1/state':{body:{state:{activeDomain:'chat'},runtimes:{}}},
  }), baseUrl:'http://local' });
  assert.equal(await client.detect(), true);
  assert.deepEqual(await client.state(), {state:{activeDomain:'chat'},runtimes:{}});
});

test('API client exposes fullstack mutations', async () => {
  const seen=[];
  const fetchImpl=async (url,options={})=>{
    const u=new URL(url);seen.push({path:u.pathname,method:options.method||'GET',body:options.body&&JSON.parse(options.body)});
    return new Response(JSON.stringify({state:{ok:true},runtime:{status:'running'}}),{status:200,headers:{'content-type':'application/json'}});
  };
  const client=createApiClient({fetchImpl,baseUrl:'http://local'});
  await client.sendMessage('conv_q4',{text:'hello',mode:'Ask',actor:'demo-user'});
  await client.decideApproval('apr_prod_1','approved','demo-user');
  await client.setControl('mission_q4','takeover');
  await client.runtime('mission_q4','start');
  await client.deleteMemory('mem2');
  assert.deepEqual(seen.map(x=>[x.method,x.path]),[
    ['POST','/api/v1/conversations/conv_q4/messages'],
    ['POST','/api/v1/approvals/apr_prod_1/decision'],
    ['POST','/api/v1/missions/mission_q4/control'],
    ['POST','/api/v1/missions/mission_q4/runtime'],
    ['DELETE','/api/v1/memory/mem2'],
  ]);
});

test('API client normalizes HTTP errors without exposing response internals', async () => {
  const client=createApiClient({fetchImpl:async()=>new Response(JSON.stringify({error:'message_required'}),{status:422,headers:{'content-type':'application/json'}}),baseUrl:'http://local'});
  await assert.rejects(()=>client.sendMessage('conv_q4',{text:''}),error=>error.code==='message_required'&&error.status===422);
});

test('API client covers conversation creation and needs-you resolution', async()=>{
  const seen=[];
  const fetchImpl=async(url,options={})=>{const u=new URL(url);seen.push([options.method||'GET',u.pathname]);return new Response(JSON.stringify({state:{}}),{status:200,headers:{'content-type':'application/json'}})};
  const client=createApiClient({fetchImpl,baseUrl:'http://local'});
  await client.createConversation({id:'conv_new',title:'New'});
  await client.resolveNeed('need_1');
  assert.deepEqual(seen,[['POST','/api/v1/conversations'],['DELETE','/api/v1/needs/need_1']]);
});

test('API client exposes scoped canonical domain reads', async()=>{
  const seen=[];
  const fetchImpl=async(url,options={})=>{const u=new URL(url);seen.push([options.method||'GET',u.pathname]);return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})};
  const client=createApiClient({fetchImpl,baseUrl:'http://local'});
  await client.needs();
  await client.missions();
  await client.agents();
  await client.artifacts();
  await client.connections();
  await client.system();
  assert.deepEqual(seen,[
    ['GET','/api/v1/needs'],['GET','/api/v1/missions'],['GET','/api/v1/agents'],['GET','/api/v1/artifacts'],['GET','/api/v1/connections'],['GET','/api/v1/system'],
  ]);
});
