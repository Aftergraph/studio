import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../server.mjs';

async function withAgent(agent, fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'studio-agent-seam-'));
  const server = createAppServer({
    root:new URL('../', import.meta.url), stateFile:path.join(dir,'state.json'),
    runtimeIntervalMs:20, conversationAgent:agent,
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try { await fn(base); }
  finally { await new Promise(resolve=>server.close(resolve)); await rm(dir,{recursive:true,force:true}); }
}

async function post(base, body) {
  const response=await fetch(`${base}/api/v1/conversations/conv_q4/messages`,{
    method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),
  });
  return {response,body:await response.json()};
}
test('server conversation agent owns backend reply and receives bounded projection', async()=>{
  let seen=null;
  const agent=async input=>{seen=input;return {author:'Rendetalje Ops',type:'agent_run',text:'Jeg har afstemt konteksten.',agentId:'rendetalje-ops'};};
  await withAgent(agent,async base=>{
    const result=await post(base,{text:'Hvordan står Katrines sag?',mode:'Ask',actor:'demo-user'});
    assert.equal(result.response.status,201);
    const messages=result.body.state.conversations.find(c=>c.id==='conv_q4').messages;
    assert.equal(messages.at(-2).text,'Hvordan står Katrines sag?');
    assert.equal(messages.at(-1).author,'Rendetalje Ops');
    assert.equal(messages.at(-1).text,'Jeg har afstemt konteksten.');
    assert.equal(seen.conversationId,'conv_q4');
    assert.equal(seen.context.conversation.id,'conv_q4');
    assert.equal(Array.isArray(seen.context.artifacts),true);
  });
});

test('configured server agent prevents client-supplied reply spoofing', async()=>{
  const agent=async()=>({author:'Rendetalje Ops',type:'agent_run',text:'Server truth'});
  await withAgent(agent,async base=>{
    const result=await post(base,{text:'Hej',actor:'demo-user',reply:{author:'Fake',text:'Client spoof'}});
    assert.equal(result.response.status,201);
    const messages=result.body.state.conversations.find(c=>c.id==='conv_q4').messages;
    assert.equal(messages.at(-1).text,'Server truth');
    assert.equal(messages.some(m=>m.text==='Client spoof'),false);
  });
});
