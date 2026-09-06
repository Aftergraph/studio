import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createInitialState } from '../src/state.mjs';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'aftergraph-v5-'));
  const stateFile=path.join(dir,'state.json');
  const server=createAppServer({root:new URL('../',import.meta.url),stateFile,runtimeIntervalMs:20});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{await fn(base,stateFile)}finally{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true})}
}

async function json(url,options){const response=await fetch(url,options);return {response,body:await response.json()}}

test('canonical V5 state contains persistent space and replay contracts',()=>{
  const state=createInitialState();
  assert.equal(state.activeDomain,'chat');
  assert.equal(state.spaces[0].id,'space_primary');
  assert.equal(state.activeSpaceId,'space_primary');
  assert.equal(state.replay.cursor,0);
  assert.equal(state.replay.playing,false);
});

test('V5 API identifies itself and returns spatial state',async()=>{
  await withServer(async base=>{
    const read=await json(`${base}/api/v1/state`);
    assert.equal(read.response.status,200);
    assert.equal(read.body.version,'aftergraph.workspace.v5');
    assert.equal(read.body.state.spaces[0].id,'space_primary');
  });
});

test('spatial mutations persist through server and restart-safe store',async()=>{
  await withServer(async base=>{
    const mutation=await json(`${base}/api/v1/spaces/space_primary`,{
      method:'PATCH',headers:{'content-type':'application/json'},
      body:JSON.stringify({ action:{type:'zoom.set',level:'agent',objectId:'agent_data'} }),
    });
    assert.equal(mutation.response.status,200);
    assert.deepEqual(mutation.body.space.zoom,{level:'agent',objectId:'agent_data'});
    const read=await json(`${base}/api/v1/state`);
    assert.deepEqual(read.body.state.spaces[0].zoom,{level:'agent',objectId:'agent_data'});
  });
});

test('replay cursor is server-owned state and clamps to durable event history',async()=>{
  await withServer(async base=>{
    const move=await json(`${base}/api/v1/replay`,{
      method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({cursor:999,playing:true}),
    });
    assert.equal(move.response.status,200);
    assert.equal(move.body.replay.cursor, move.body.frameCount-1);
    assert.equal(move.body.replay.playing,true);
  });
});

test('multimodal intent attachment metadata persists through the full-stack chat contract',async()=>{
  await withServer(async base=>{
    const write=await json(`${base}/api/v1/conversations/conv_q4/messages`,{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'Analyze the attached brief',mode:'Research',actor:'demo-user',attachments:[{name:'brief.pdf',kind:'application/pdf'},{name:'chart.png',kind:'image/png'}]}),
    });
    assert.equal(write.response.status,201);
    const conversation=write.body.state.conversations.find(c=>c.id==='conv_q4');
    const message=conversation.messages.at(-1);
    assert.deepEqual(message.attachments,[{name:'brief.pdf',kind:'application/pdf'},{name:'chart.png',kind:'image/png'}]);
  });
});
