import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { projectConversationMessages } from '../src/conversation-message-projection.mjs';
import { isRuntimePatchOnly } from '../src/backend-reconciliation.mjs';

test('conversation: intentional text, plans and agent progress stay visible', () => {
  const messages = [
    { id:'u', author:'user', type:'text', text:'Run this' },
    { id:'p', author:'Friday', type:'plan', text:'I will investigate' },
    { id:'r', author:'system', type:'agent_run', text:'Agent working' },
    { id:'g', author:'Friday', type:'generated', text:'Generated workspace view', generatedUI:[{kind:'text'}] },
  ];
  assert.deepEqual(projectConversationMessages(messages), messages);
});

test('conversation: tool calls, session events, attempts and traces never render', () => {
  const internalTypes = [
    'tool_call', 'tool_result', 'session', 'session_event',
    'execution_attempt', 'trace', 'runtime_trace', 'audit_event',
  ];
  for (const type of internalTypes) {
    assert.deepEqual(projectConversationMessages([
      { type, visibility:'conversation', text:'internal payload', author:'Friday' },
    ]), [], type);
  }
});

test('conversation: explicit internal/debug visibility overrides user-facing type', () => {
  for (const visibility of ['internal', 'debug', 'private']) {
    assert.deepEqual(projectConversationMessages([
      { type:'text', visibility, author:'Friday', text:'private payload' },
    ]), []);
  }
});

test('conversation: unknown types and malformed records fail closed', () => {
  assert.deepEqual(projectConversationMessages([
    null, 1, {}, { type:'unrecognized_event', text:'unsafe', author:'Friday' },
    { type:'text', text:null, author:'Friday' },
  ]), []);
  assert.deepEqual(projectConversationMessages(null), []);
});

test('conversation: legacy untyped user text remains readable without exposing system entries', () => {
  assert.deepEqual(projectConversationMessages([
    { id:'u', author:'user', text:'Hello' },
    { id:'s', author:'system', text:'Internal diagnostic' },
  ]).map(message=>message.id), ['u']);
});

test('conversation: projection does not mutate events or upgrade evidence status', () => {
  const userMessage=Object.freeze({id:'m', author:'Friday', type:'text', text:'Done', verified:true});
  const trace=Object.freeze({id:'t', author:'system', type:'trace', text:'internal'});
  const source=Object.freeze([userMessage,trace]);
  assert.deepEqual(projectConversationMessages(source), [userMessage]);
  assert.equal(source.length,2);
  assert.equal(projectConversationMessages(source)[0].verified,true);
});

test('conversation: internal-only messages do not force a structural chat rerender', () => {
  const previous={
    conversations:[{id:'c',title:'Thread',status:'active',messages:[
      {id:'u',author:'user',type:'text',text:'Hello'},
    ]}],
  };
  const next=structuredClone(previous);
  next.conversations[0].messages.push({
    id:'internal-1', author:'system', type:'tool_call', text:'debug payload',
  });
  assert.equal(isRuntimePatchOnly(previous,next),true);
  next.conversations[0].messages.push({
    id:'visible-1', author:'Friday', type:'text', text:'Ready',
  });
  assert.equal(isRuntimePatchOnly(previous,next),false);
});

test('conversation: browser harnesses declare projection module before dependent modules', () => {
  const harnesses = [
    'scripts/browser_smoke.py',
    'scripts/browser_smoke_v5.py',
    'scripts/capture_v5_2_visuals.py',
    'scripts/fullstack_bridge_smoke.py',
    'scripts/fullstack_bridge_smoke_v5.py',
    'scripts/polyrepo_bridge_smoke_v5.py',
    'scripts/v5_2_browser_qa.py',
  ];
  for (const file of harnesses) {
    const content=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    const projection=content.indexOf("'src/conversation-message-projection.mjs'");
    const reconciliation=content.indexOf("'src/backend-reconciliation.mjs'");
    assert.ok(projection>=0, file+' must bundle the projection module');
    assert.ok(projection<reconciliation, file+' must load projection before backend reconciliation');
  }
  const verify=readFileSync(new URL('../scripts/verify.mjs',import.meta.url),'utf8');
  assert.ok(verify.includes("'src/conversation-message-projection.mjs'"),'release verifier includes projection syntax');
});
