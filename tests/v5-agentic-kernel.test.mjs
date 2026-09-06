import test from 'node:test';
import assert from 'node:assert/strict';
import { derivePresence, AGPresenceRail, AGAgentPresence } from '../packages/presence/index.mjs';
import { AGTrajectoryGraph, AGEvidenceGraph, AGReplayTimeline } from '../packages/visualization/index.mjs';
import { normalizeIntent, AGIntentComposer } from '../packages/composer/index.mjs';
import { resolveInteraction } from '../packages/interaction/index.mjs';
import { buildReplayFrames, replayAt } from '../src/replay.mjs';
import { createInitialState } from '../src/state.mjs';

test('presence model treats humans and agents as typed first-class actors', () => {
  const state = createInitialState();
  const presence = derivePresence({ user:state.user, agents:state.agents, followedAgentId:'agent_data' });
  assert.equal(presence[0].kind, 'human');
  assert.equal(presence.find(x=>x.id==='agent_data').followed, true);
  assert.equal(presence.filter(x=>x.state==='running').length, 2);
});

test('presence UI exposes follow interaction without depending on avatar decoration', () => {
  const html = AGPresenceRail({ presence:[
    {id:'demo-user',kind:'human',name:'Demo User',state:'active',detail:'Operator'},
    {id:'agent_data',kind:'agent',name:'Data Analysis Agent',state:'running',detail:'Q4 report metrics',followed:true},
  ]});
  assert.match(html, /data-ag-component="presence-rail"/);
  assert.match(html, /data-presence-id="agent_data"/);
  assert.match(html, /data-presence-action="follow"/);
});

test('trajectory graph is an accessible interactive SVG owned by Aftergraph', () => {
  const mission = createInitialState().missions[0];
  const html = AGTrajectoryGraph({ mission });
  assert.match(html, /<svg/);
  assert.match(html, /data-ag-component="trajectory-graph"/);
  assert.match(html, /role="img"/);
  assert.match(html, /data-trajectory-node="s2"/);
  assert.match(html, /tabindex="0"/);
});

test('evidence graph keeps verification connected to the mission', () => {
  const html = AGEvidenceGraph({ missionId:'mission_q4', evidenceCount:4, verified:false });
  assert.match(html, /mission_q4/);
  assert.match(html, /4 evidence/);
  assert.match(html, /verification pending/);
});

test('intent composer normalizes multimodal context and capability mode', () => {
  const intent = normalizeIntent({ text:'Fix this', mode:'build', context:[{type:'artifact',id:'art_q4'}, {type:'artifact',id:'art_q4'}, {type:'mission',id:'mission_q4'}], attachments:[{name:'error.png',kind:'image'}] });
  assert.equal(intent.mode, 'Build');
  assert.equal(intent.context.length, 2);
  assert.equal(intent.attachments.length, 1);
  const html = AGIntentComposer({ intent, capabilities:['Build','Research','Delegate'] });
  assert.match(html, /data-ag-component="intent-composer"/);
  assert.match(html, /data-capability="Build"/);
  assert.match(html, /Fix this/);
  assert.match(html, /error.png/);
});

test('interaction resolver converts semantic commands to spatial actions', () => {
  assert.deepEqual(resolveInteraction({ command:'focus-surface', surfaceId:'artifact:art_q4' }), { type:'surface.focus', surfaceId:'artifact:art_q4' });
  assert.deepEqual(resolveInteraction({ command:'zoom-in', level:'task', objectId:'task_1' }), { type:'zoom.set', level:'agent', objectId:'task_1' });
});

test('replay builds deterministic temporal frames from durable events', () => {
  const state=createInitialState();
  const frames=buildReplayFrames(state.events);
  assert.equal(frames.length, state.events.length);
  assert.equal(frames[0].index, 0);
  const frame=replayAt(frames, 2);
  assert.equal(frame.index, 2);
  assert.ok(frame.event.id);
});

test('presence rail supports a real collapsed state',()=>{
  const html=AGPresenceRail({presence:[{id:'agent_1',kind:'agent',name:'Scout',state:'running',detail:'Research'}],collapsed:true});
  assert.match(html,/is-collapsed/);
  assert.match(html,/aria-expanded="false"/);
});

test('intent composer disables host-dependent voice when no voice capability is supplied',()=>{
  const html=AGIntentComposer({intent:{mode:'Ask',context:[],attachments:[]},voiceAvailable:false});
  assert.match(html,/data-composer-action="voice"[^>]*disabled/);
  assert.match(html,/Voice requires a connected host/);
});

test('replay timeline exposes playback controls as part of the time layer',()=>{
  const frames=buildReplayFrames(createInitialState().events);
  const html=AGReplayTimeline({frames,activeIndex:0,playing:false});
  assert.match(html,/data-replay-action="play"/);
  assert.match(html,/aria-label="Play replay"/);
});

test('intent composer exposes a real local file attachment input',()=>{
  const html=AGIntentComposer({intent:{mode:'Ask',context:[],attachments:[]}});
  assert.match(html,/type="file"/);
  assert.match(html,/data-intent-files/);
});
