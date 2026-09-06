import test from 'node:test';
import assert from 'node:assert/strict';
import * as systemView from '../src/views/system-view.mjs';
import * as controlView from '../src/views/control-view.mjs';

const services={
  trustGateway:{configured:true,online:true,role:'runtime-enforcement',repo:'Aftergraph/trust-gateway',headSha:'515f8f744ff9b0a14df7398e38693fd3ac7ab667'},
  works:{configured:true,online:false,role:'durable-execution',repo:'Aftergraph/works-execution',headSha:'3ea1a80494c38f3e422339db6efbf5a7935a48be'},
};

test('System surface collapses exact-head provenance and represents degraded service state in text',()=>{
  assert.equal(typeof systemView.renderSystemSurface,'function');
  const html=systemView.renderSystemSurface({
    services,
    telemetry:{runtime:'healthy',latency:34,activeRuns:1,evidence:8,cost:0.23,chain:'verified'},
    syncedAt:'2026-09-06T05:00:00Z',backendPhase:'stale',
    identity:{name:'Operator',role:'operator',capabilityLabel:'scoped capabilities'},events:[],
  });
  assert.match(html,/data-domain-surface="system"/);
  assert.match(html,/data-system-state="stale"/);
  assert.match(html,/>Stale</);
  assert.match(html,/<details[^>]*class="[^"]*ag-source-truth-details/);
  assert.match(html,/515f8f74/);
  assert.doesNotMatch(html,/Bearer\s+|api[_-]?key|secret|password/i);
});

test('Control surface prioritizes pending decisions and keeps provenance secondary',()=>{
  assert.equal(typeof controlView.renderControlSurface,'function');
  const html=controlView.renderControlSurface({
    localApprovals:[{id:'ap_local',title:'Deploy production',risk:'destructive',authority:'operator',state:'pending'}],
    remoteApprovals:[{id:'ap_tg',title:'Rotate key',status:'pending'}],
    exceptions:[{id:'need_1',type:'credential',title:'Credential required',severity:'high',detail:'WORKS'}],
    events:[{id:'evt_1',type:'approval.required',label:'Approval required'}],
    service:{headSha:'515f8f744ff9b0a14df7398e38693fd3ac7ab667'},
  });
  const attentionAt=html.indexOf('ag-control-attention');
  const provenanceAt=html.indexOf('ag-control-provenance');
  assert.ok(attentionAt>=0 && provenanceAt>attentionAt);
  assert.match(html,/data-upstream-approval="ap_tg"/);
  assert.match(html,/data-upstream-decision="approve"/);
  assert.match(html,/data-upstream-decision="deny"/);
  assert.doesNotMatch(html,/token=|authorization|password|secret/i);
});
