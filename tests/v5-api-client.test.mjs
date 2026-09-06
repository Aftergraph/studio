import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/api-client.mjs';

function fakeFetch(routes){return async(url,options={})=>{const path=String(url).replace('http://local','');const key=`${options.method||'GET'} ${path}`;const body=routes[key];if(!body)return new Response(JSON.stringify({error:'missing'}),{status:404,headers:{'content-type':'application/json'}});return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}})}}

test('V5 client exposes spatial reads and mutations', async()=>{
  const client=createApiClient({baseUrl:'http://local',fetchImpl:fakeFetch({
    'GET /api/v1/spaces':{spaces:[{id:'space_primary'}]},
    'PATCH /api/v1/spaces/space_primary':{space:{id:'space_primary',zoom:{level:'agent',objectId:'agent_data'}}},
  })});
  assert.equal((await client.spaces()).spaces[0].id,'space_primary');
  assert.equal((await client.updateSpace('space_primary',{type:'zoom.set',level:'agent',objectId:'agent_data'})).space.zoom.level,'agent');
});

test('V5 client exposes replay controls', async()=>{
  const client=createApiClient({baseUrl:'http://local',fetchImpl:fakeFetch({
    'PATCH /api/v1/replay':{replay:{cursor:2,playing:true,speed:1},frameCount:4},
  })});
  const result=await client.replay({cursor:2,playing:true});
  assert.equal(result.replay.cursor,2);
  assert.equal(result.replay.playing,true);
});
