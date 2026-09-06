import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/api-client.mjs';

function response(body,status=200){return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}})}

test('V5 API client exposes explicit upstream integration operations',async()=>{
  const calls=[];
  const client=createApiClient({fetchImpl:async(url,options={})=>{calls.push({url,method:options.method||'GET',body:options.body?JSON.parse(options.body):null});return response({ok:true})}});
  await client.upstreams();
  await client.syncUpstreams();
  await client.decideUpstreamApproval('apr 1','approve');
  await client.controlUpstreamWork('wrk_1','suspend',{reason:'human'});
  await client.reviewWorkIntelligence('wi_1',{actor:'jonas',decision:'approve'});
  await client.promoteWorkIntelligence('wi_1',{actor:'jonas',confirmed:true});
  await client.cancelAieTask('task/1');
  await client.sendAieMessage({message:{messageId:'msg-1',parts:[]}});
  assert.deepEqual(calls.map(c=>`${c.method} ${new URL(c.url,'http://x').pathname}`),[
    'GET /api/v1/upstreams',
    'POST /api/v1/upstreams/sync',
    'POST /api/v1/upstreams/trust-gateway/approvals/apr%201/decision',
    'POST /api/v1/upstreams/works/wrk_1/control',
    'POST /api/v1/upstreams/work-intelligence/wi_1/review',
    'POST /api/v1/upstreams/work-intelligence/wi_1/promote',
    'POST /api/v1/upstreams/aie/tasks/task%2F1/cancel',
    'POST /api/v1/upstreams/aie/messages',
  ]);
  assert.deepEqual(calls[2].body,{decision:'approve'});
  assert.deepEqual(calls[5].body,{actor:'jonas',confirmed:true});
});
