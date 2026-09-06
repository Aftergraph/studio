import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withServer(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'aftergraph-v4-api-'));
  const stateFile = path.join(dir, 'state.json');
  const server = createAppServer({ root: new URL('../', import.meta.url), stateFile, runtimeIntervalMs: 20 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try { await fn(`http://127.0.0.1:${port}`); }
  finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive:true, force:true }); }
}

async function json(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  return { response, body };
}

test('fullstack state endpoint returns canonical workspace state', async () => {
  await withServer(async base => {
    const { response, body } = await json(`${base}/api/v1/state`);
    assert.equal(response.status, 200);
    assert.equal(body.version, 'aftergraph.workspace.v5');
    assert.equal(body.state.activeDomain, 'chat');
    assert.equal(body.state.missions.some(m => m.id === 'mission_q4'), true);
    assert.deepEqual(body.runtimes, {});
  });
});

test('chat writes persist across API reads', async () => {
  await withServer(async base => {
    const payload = { text:'Ship the verified report to the workspace.', mode:'Ask', actor:'demo-user' };
    const write = await json(`${base}/api/v1/conversations/conv_q4/messages`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload),
    });
    assert.equal(write.response.status, 201);
    assert.equal(write.body.state.conversations.find(c=>c.id==='conv_q4').messages.at(-1).text, payload.text);

    const read = await json(`${base}/api/v1/state`);
    assert.equal(read.body.state.conversations.find(c=>c.id==='conv_q4').messages.at(-1).text, payload.text);
  });
});

test('approval and takeover mutations use canonical state semantics', async () => {
  await withServer(async base => {
    const approval = await json(`${base}/api/v1/approvals/apr_prod_1/decision`, {
      method:'POST', headers:{'content-type':'application/json','idempotency-key':'approval-test-1'}, body:JSON.stringify({decision:'approved', actor:'demo-user', idempotencyKey:'approval-test-1'}),
    });
    assert.equal(approval.response.status, 200);
    assert.equal(approval.body.state.approvals.find(a=>a.id==='apr_prod_1').state, 'approved');
    assert.equal(approval.body.state.missions.find(m=>m.id==='mission_release').state, 'running');

    const takeover = await json(`${base}/api/v1/missions/mission_q4/control`, {
      method:'POST', headers:{'content-type':'application/json','idempotency-key':'control-test-1'}, body:JSON.stringify({mode:'takeover', actor:'demo-user', idempotencyKey:'control-test-1'}),
    });
    assert.equal(takeover.response.status, 200);
    assert.equal(takeover.body.state.missions.find(m=>m.id==='mission_q4').controlMode, 'takeover');
  });
});

test('server-owned mission runtime progresses and can pause', async () => {
  await withServer(async base => {
    const start = await json(`${base}/api/v1/missions/mission_q4/runtime`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'start'}),
    });
    assert.equal(start.response.status, 200);
    assert.equal(start.body.runtime.status, 'running');
    const before = start.body.state.missions.find(m=>m.id==='mission_q4').progress;

    await new Promise(resolve => setTimeout(resolve, 70));
    const read = await json(`${base}/api/v1/state`);
    const after = read.body.state.missions.find(m=>m.id==='mission_q4').progress;
    assert.ok(after > before, `expected ${after} > ${before}`);

    const paused = await json(`${base}/api/v1/missions/mission_q4/runtime`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({action:'pause'}),
    });
    assert.equal(paused.body.runtime.status, 'paused');
    const pausedAt = paused.body.state.missions.find(m=>m.id==='mission_q4').progress;
    await new Promise(resolve => setTimeout(resolve, 60));
    const still = await json(`${base}/api/v1/state`);
    assert.equal(still.body.state.missions.find(m=>m.id==='mission_q4').progress, pausedAt);
  });
});

test('context, artifact, memory and reset endpoints are real server contracts', async () => {
  await withServer(async base => {
    const context = await json(`${base}/api/v1/context?conversationId=conv_q4`);
    assert.equal(context.response.status, 200);
    assert.equal(context.body.conversation.id, 'conv_q4');
    assert.equal(Array.isArray(context.body.memory), true);
    assert.equal(Array.isArray(context.body.connections), true);

    const artifact = await json(`${base}/api/v1/artifacts/art_q4`);
    assert.equal(artifact.response.status, 200);
    assert.equal(artifact.body.artifact.id, 'art_q4');

    const deleted = await json(`${base}/api/v1/memory/mem2`, { method:'DELETE', headers:{'content-type':'application/json','idempotency-key':'memory-test-1'}, body:JSON.stringify({actor:'demo-user', idempotencyKey:'memory-test-1'}) });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.body.state.memory.some(m=>m.id==='mem2'), false);

    const reset = await json(`${base}/api/v1/reset`, { method:'POST', headers:{'content-type':'application/json','idempotency-key':'reset-test-1'}, body:JSON.stringify({actor:'demo-user', confirmationToken:'RESET_WORKSPACE', idempotencyKey:'reset-test-1'}) });
    assert.equal(reset.response.status, 200);
    assert.equal(reset.body.state.memory.some(m=>m.id==='mem2'), true);
  });
});

test('API rejects malformed JSON and unknown resources without leaking internals', async () => {
  await withServer(async base => {
    const bad = await fetch(`${base}/api/v1/conversations/conv_q4/messages`, {
      method:'POST', headers:{'content-type':'application/json'}, body:'{broken',
    });
    assert.equal(bad.status, 400);
    assert.deepEqual(await bad.json(), { error:'invalid_json' });

    const missing = await fetch(`${base}/api/v1/artifacts/nope`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error:'artifact_not_found' });
  });
});

test('new conversations and Needs You resolution persist through server contracts', async () => {
  await withServer(async base => {
    const created = await json(`${base}/api/v1/conversations`, {
      method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({id:'conv_new_test',title:'New persistent chat'}),
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.state.conversations.some(c=>c.id==='conv_new_test'), true);

    const resolved = await json(`${base}/api/v1/needs/need_budget_1`, { method:'DELETE' });
    assert.equal(resolved.response.status, 200);
    assert.equal(resolved.body.state.needsYou.some(n=>n.id==='need_budget_1'), false);
  });
});

test('durable state survives a server restart', async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'aftergraph-v4-restart-'));
  const stateFile=path.join(dir,'state.json');
  const root=new URL('../',import.meta.url);
  let first=createAppServer({root,stateFile});
  await new Promise(resolve=>first.listen(0,'127.0.0.1',resolve));
  let port=first.address().port;
  await json(`http://127.0.0.1:${port}/api/v1/conversations/conv_q4/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:'persist me',actor:'demo-user'})});
  await new Promise(resolve=>first.close(resolve));

  let second=createAppServer({root,stateFile});
  await new Promise(resolve=>second.listen(0,'127.0.0.1',resolve));
  port=second.address().port;
  const read=await json(`http://127.0.0.1:${port}/api/v1/state`);
  assert.equal(read.body.state.conversations.find(c=>c.id==='conv_q4').messages.at(-1).text,'persist me');
  await new Promise(resolve=>second.close(resolve));
  await rm(dir,{recursive:true,force:true});
});

test('SSE endpoint emits canonical workspace snapshot', async()=>{
  await withServer(async base=>{
    const response=await fetch(`${base}/api/v1/events`,{headers:{accept:'text/event-stream'}});
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-type')||'',/text\/event-stream/);
    const reader=response.body.getReader();
    const {value}=await reader.read();
    const text=new TextDecoder().decode(value);
    assert.match(text,/event: workspace/);
    assert.match(text,/aftergraph\.workspace\.v5/);
    await reader.cancel();
  });
});

test('canonical domain resources have scoped read endpoints', async()=>{
  await withServer(async base=>{
    const expectations={
      '/api/v1/needs':'needsYou',
      '/api/v1/missions':'missions',
      '/api/v1/agents':'agents',
      '/api/v1/artifacts':'artifacts',
      '/api/v1/connections':'connections',
    };
    for (const [route,key] of Object.entries(expectations)) {
      const {response,body}=await json(base+route);
      assert.equal(response.status,200,route);
      assert.equal(Array.isArray(body[key]),true,route);
      assert.ok(body[key].length>0,route);
    }
    const system=await json(`${base}/api/v1/system`);
    assert.equal(system.response.status,200);
    assert.equal(system.body.version,'aftergraph.workspace.v5');
    assert.equal(system.body.telemetry.chain,'verified');
    assert.equal(typeof system.body.backend.runtimeCount,'number');
  });
});

test('V81-016 destructive endpoints require actor, confirmation and idempotency', async()=>{
  await withServer(async base=>{
    const denied=await json(`${base}/api/v1/approvals/apr_prod_1/decision`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'deny-1'},body:JSON.stringify({decision:'approved',actor:'agent:worker',idempotencyKey:'deny-1'})});
    assert.equal(denied.response.status,403);
    const missing=await json(`${base}/api/v1/missions/mission_q4/control`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'missing-1'},body:JSON.stringify({mode:'takeover',idempotencyKey:'missing-1'})});
    assert.equal(missing.response.status,422);
    const noConfirm=await json(`${base}/api/v1/reset`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'reset-1'},body:JSON.stringify({actor:'demo-user',idempotencyKey:'reset-1'})});
    assert.equal(noConfirm.response.status,422);
    const body={decision:'approved',actor:'demo-user',idempotencyKey:'approval-once'};
    const first=await json(`${base}/api/v1/approvals/apr_prod_1/decision`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'approval-once'},body:JSON.stringify(body)});
    assert.equal(first.response.status,200);
    const duplicate=await json(`${base}/api/v1/approvals/apr_prod_1/decision`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':'approval-once'},body:JSON.stringify(body)});
    assert.equal(duplicate.response.status,409);
  });
});
