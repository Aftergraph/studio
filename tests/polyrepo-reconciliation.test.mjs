import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.mjs';
import { reconcileUpstreamSync } from '../src/backend-reconciliation.mjs';

const clone=value=>structuredClone(value);

test('background upstream sync updates source truth without stealing local navigation',()=>{
  const local=createInitialState();
  local.activeDomain='system';
  local.primaryMode='space';
  local.activeConversationId='conv_local';
  local.activeSpaceId='space_local';
  local.events=[{id:'local_event'}];

  const server=clone(createInitialState());
  server.activeDomain='chat';
  server.primaryMode='chat';
  server.activeConversationId='conv_server';
  server.activeSpaceId='space_server';
  server.events=[{id:'upstream_sync_event'}];

  const upstreams={
    syncedAt:'2026-09-06T00:00:00Z',
    services:{trustGateway:{state:'online'}},
    trustGateway:{identity:{name:'Atlas'},approvals:[],needsYou:[],audit:{ok:true}},
  };

  const reconciled=reconcileUpstreamSync(local,{state:server,upstreams});

  assert.equal(reconciled.activeDomain,'system');
  assert.equal(reconciled.primaryMode,'space');
  assert.equal(reconciled.activeConversationId,'conv_local');
  assert.equal(reconciled.activeSpaceId,'space_local');
  assert.deepEqual(reconciled.upstreams,upstreams);
  assert.deepEqual(reconciled.events,server.events);
});

test('upstream sync without a source-truth payload leaves local state intact',()=>{
  const local=createInitialState();
  local.activeDomain='control';
  assert.deepEqual(reconcileUpstreamSync(local,{state:{activeDomain:'chat'}}),local);
});

import { isUpstreamProjectionOnly } from '../src/backend-reconciliation.mjs';

test('upstream projection event tolerates stale server navigation but rejects mission changes',()=>{
  const local=createInitialState();
  local.activeDomain='system';
  local.primaryMode='space';
  local.upstreams={syncedAt:null};

  const sync=clone(local);
  sync.activeDomain='chat';
  sync.primaryMode='chat';
  sync.upstreams={syncedAt:'now',services:{trustGateway:{state:'online'}}};
  sync.events=[{id:'sync'}];
  assert.equal(isUpstreamProjectionOnly(local,sync),true);

  const missionChange=clone(sync);
  missionChange.missions[0].state='paused';
  assert.equal(isUpstreamProjectionOnly(local,missionChange),false);
});

import { reconcileBackgroundState } from '../src/backend-reconciliation.mjs';

test('background server events update runtime data without navigating the user',()=>{
  const local=createInitialState();
  local.activeDomain='system';
  local.primaryMode='space';
  local.activeConversationId='conv_code';
  local.activeSpaceId='space_primary';
  local.composerMode='Research';
  local.theme='dark';

  const server=clone(local);
  server.activeDomain='chat';
  server.primaryMode='chat';
  server.activeConversationId='conv_q4';
  server.composerMode='Ask';
  server.theme='light';
  server.missions[0].progress=73;
  server.telemetry.latency=42;

  const reconciled=reconcileBackgroundState(local,server);
  assert.equal(reconciled.activeDomain,'system');
  assert.equal(reconciled.primaryMode,'space');
  assert.equal(reconciled.activeConversationId,'conv_code');
  assert.equal(reconciled.activeSpaceId,'space_primary');
  assert.equal(reconciled.composerMode,'Research');
  assert.equal(reconciled.theme,'dark');
  assert.equal(reconciled.missions[0].progress,73);
  assert.equal(reconciled.telemetry.latency,42);
});
