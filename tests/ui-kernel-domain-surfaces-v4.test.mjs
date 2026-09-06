import test from 'node:test';
import assert from 'node:assert/strict';
import { AGAgentCard, AGConnectionRow, AGArtifactRow, AGEventRow, COMPONENTS } from '../packages/ui/index.mjs';

test('agent surface communicates ownership, runtime, authority and evidence as one semantic component', () => {
  const html=AGAgentCard({agent:{id:'agent_data',name:'Data Analysis Agent',role:'Analyst',state:'running',task:'Q4 metrics',authority:'read:data/*',spend:1.28,evidence:8}});
  assert.match(html,/data-ag-component="agent-card"/);
  assert.match(html,/data-agent="agent_data"/);
  assert.match(html,/Data Analysis Agent/);
  assert.match(html,/Q4 metrics/);
  assert.match(html,/read:data\/\*/);
  assert.match(html,/8 evidence/);
});

test('connection row exposes health, permissions and latency without generic dashboard cards', () => {
  const html=AGConnectionRow({connection:{id:'conn_github',name:'GitHub',kind:'Connector',state:'needs_attention',permissions:['repo.read','issues.read'],latency:84}});
  assert.match(html,/data-ag-component="connection-row"/);
  assert.match(html,/data-connection="conn_github"/);
  assert.match(html,/needs attention/);
  assert.match(html,/2 permissions/);
  assert.match(html,/84ms/);
});

test('artifact and event rows keep durable output and history directly actionable', () => {
  const artifact=AGArtifactRow({artifact:{id:'art_q4',title:'q4_report_draft.md',kind:'Document',state:'draft',verified:false,updated:'2 min ago'}});
  const event=AGEventRow({event:{id:'ev1',type:'mission.started',text:'Q4 report mission started',time:'10:24'}});
  assert.match(artifact,/data-ag-component="artifact-row"/);
  assert.match(artifact,/data-artifact="art_q4"/);
  assert.match(event,/data-ag-component="event-row"/);
  assert.match(event,/mission\.started/);
  for (const name of ['AGAgentCard','AGConnectionRow','AGArtifactRow','AGEventRow']) assert.ok(COMPONENTS.includes(name));
});
