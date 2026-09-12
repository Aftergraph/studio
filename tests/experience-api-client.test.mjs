import test from 'node:test';
import assert from 'node:assert/strict';
import { apiExperience, apiExperienceEvents } from '../src/api-routes.mjs';
import { createApiClient } from '../src/api-client.mjs';

test('experience route builders are canonical',()=>{
  assert.equal(apiExperience(),'/api/v1/experience');
  assert.equal(apiExperienceEvents({after:7,limit:25}),'/api/v1/experience/events?after=7&limit=25');
});

test('API client reads writes and follows experience deltas',async()=>{
  const seen=[];
  const fetchImpl=async(url,options={})=>{
    const u=new URL(url); seen.push({method:options.method||'GET',path:u.pathname+u.search,headers:options.headers||{},body:options.body&&JSON.parse(options.body)});
    return new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}});
  };
  const client=createApiClient({baseUrl:'http://local',fetchImpl});
  await client.experience();
  await client.writeExperience({expectedVersion:0,document:{layout:{mode:'chat'}},idempotencyKey:'exp-1'});
  await client.experienceEvents({after:1,limit:10});
  assert.deepEqual(seen.map(x=>[x.method,x.path]),[
    ['GET','/api/v1/experience'],
    ['PUT','/api/v1/experience'],
    ['GET','/api/v1/experience/events?after=1&limit=10'],
  ]);
  assert.equal(seen[1].headers['idempotency-key'],'exp-1');
  assert.equal(seen[1].body.expectedVersion,0);
});
