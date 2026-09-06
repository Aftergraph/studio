import test from 'node:test';
import assert from 'node:assert/strict';
import { AGContextSummary, AGMemoryItem, AGWorkSummary, AGTelemetryStrip, COMPONENTS } from '../packages/ui/index.mjs';

test('kernel owns context, memory, work and telemetry surfaces',()=>{
  for(const name of ['AGContextSummary','AGMemoryItem','AGWorkSummary','AGTelemetryStrip']) assert.ok(COMPONENTS.includes(name),name);
});

test('context and memory components expose semantic state and revocation action',()=>{
  const context=AGContextSummary({conversation:'Q4',mission:'Build report',agent:'Friday',authority:'Operator',evidence:4,backend:'connected'});
  assert.match(context,/data-ag-component="context-summary"/);
  assert.match(context,/data-backend="connected"/);
  const memory=AGMemoryItem({id:'mem2',label:'Q4 style',scope:'project',source:'user',promoted:false});
  assert.match(memory,/data-ag-component="memory-item"/);
  assert.match(memory,/data-action="revoke-memory"/);
  assert.match(memory,/data-id="mem2"/);
});

test('work summary and telemetry communicate meaning without generic cards',()=>{
  const work=AGWorkSummary({mission:{id:'m1',title:'Ship',progress:64,state:'running',agent:'Friday',budget:{used:2,max:5,currency:'€'},evidenceCount:7,verified:false}});
  assert.match(work,/data-ag-component="work-summary"/);
  assert.match(work,/aria-valuenow="64"/);
  const telemetry=AGTelemetryStrip({telemetry:{online:true,runtime:'healthy',chain:'verified',cost:8.49,activeRuns:3,queued:1,evidence:64,latency:148},backend:'connected'});
  assert.match(telemetry,/data-ag-component="telemetry-strip"/);
  assert.match(telemetry,/148ms/);
});
