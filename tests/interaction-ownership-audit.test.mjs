import test from 'node:test';
import assert from 'node:assert/strict';
import { auditInteractionOwnership } from '../src/interaction/ownership-audit.mjs';

test('audit detects reviewed-head drift without rewriting ownership', () => {
  const report = auditInteractionOwnership({
    topology:{repositories:[
      {name:'studio',architecture_plane:'experience',role:'primary-experience'},
      {name:'runtime',architecture_plane:'runtime',role:'agent-runtime'},
    ]},
    orgState:{repositories:[{full_name:'Aftergraph/runtime',remote_head_sha:'new-runtime'}]},
    reviewedManifest:{repos:{runtime:{repo:'Aftergraph/runtime',head:'old-runtime'}}},
  });
  assert.equal(report.repositories.runtime.state,'drifted');
  assert.equal(report.repositories.runtime.owner,'agent-runtime');
  assert.equal(report.repositories.runtime.currentHead,'new-runtime');
  assert.equal(report.repositories.runtime.reviewedHead,'old-runtime');
});

test('Experience-plane ownership remains studio, relay and wi-frontend only', () => {
  const topology={repositories:[
    {name:'studio',architecture_plane:'experience',role:'primary-experience'},
    {name:'relay',architecture_plane:'experience',role:'human-operator-plane'},
    {name:'wi-frontend',architecture_plane:'experience',role:'work-intelligence-experience'},
    {name:'runtime',architecture_plane:'runtime',role:'agent-runtime'},
  ]};
  const experience=topology.repositories.filter(r=>r.architecture_plane==='experience').map(r=>r.name).sort();
  assert.deepEqual(experience,['relay','studio','wi-frontend']);
  const report=auditInteractionOwnership({
    topology,
    orgState:{repositories:[]},
    reviewedManifest:{repos:{runtime:{repo:'Aftergraph/runtime',head:'reviewed-only'}}},
  });
  assert.equal(report.repositories.runtime.state,'unreviewed');
  assert.equal(report.repositories.runtime.currentHead,null);
});

import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('CLI writes deterministic drift report and does not fail on drift', () => {
  const dir=mkdtempSync(join(tmpdir(),'ag-interaction-audit-'));
  const topology=join(dir,'topology.json');
  const orgState=join(dir,'org-state.json');
  const manifest=join(dir,'manifest.json');
  const out=join(dir,'out.json');
  writeFileSync(topology,JSON.stringify({repositories:[{name:'runtime',architecture_plane:'runtime',role:'agent-runtime'}]}));
  writeFileSync(orgState,JSON.stringify({repositories:[{full_name:'Aftergraph/runtime',remote_head_sha:'new'}]}));
  writeFileSync(manifest,JSON.stringify({repos:{runtime:{repo:'Aftergraph/runtime',head:'old'}}}));
  const run=spawnSync(process.execPath,['scripts/audit-interaction-convergence.mjs','--topology',topology,'--org-state',orgState,'--reviewed-manifest',manifest,'--out',out],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout);
  const report=JSON.parse(readFileSync(out,'utf8'));
  assert.equal(report.repositories.runtime.state,'drifted');
});
