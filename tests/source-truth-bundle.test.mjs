import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateSourceTruthBundle } from '../src/integrations/source-truth.mjs';
import { UPSTREAM_REVISIONS } from '../src/integrations/upstream-hub.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const upstreamRoot=path.join(here,'..','upstreams');
const json=async rel=>JSON.parse(await readFile(path.join(upstreamRoot,rel),'utf8'));

test('materialized source-truth bundle matches every pinned runtime/reference revision and boundary contract',async()=>{
  const report=validateSourceTruthBundle({
    manifest:await json('UPSTREAM-MANIFEST.json'),
    missionState:await json('contracts/governance/mission-state-1.0.json'),
    policyToken:await json('contracts/governance/policy.token.schema.json'),
    workIntelligenceBoundary:await json('contracts/work-intelligence/work-intelligence-boundary-1.0.json'),
    revisions:UPSTREAM_REVISIONS,
  });
  assert.equal(report.ok,true,report.errors.join('\n'));
  assert.equal(report.repositories,6);
  assert.equal(report.missionStates,12);
  assert.equal(report.workIntelligenceExecutionAuthority,'none');
  assert.equal(report.workIntelligenceHumanReviewRequired,true);
});

test('source-truth validation fails closed on head drift',async()=>{
  const manifest=await json('UPSTREAM-MANIFEST.json');
  manifest.repos['trust-gateway'].head='0'.repeat(40);
  const report=validateSourceTruthBundle({
    manifest,
    missionState:await json('contracts/governance/mission-state-1.0.json'),
    policyToken:await json('contracts/governance/policy.token.schema.json'),
    workIntelligenceBoundary:await json('contracts/work-intelligence/work-intelligence-boundary-1.0.json'),
    revisions:UPSTREAM_REVISIONS,
  });
  assert.equal(report.ok,false);
  assert.ok(report.errors.some(error=>error.includes('trust-gateway')&&error.includes('head mismatch')));
});
