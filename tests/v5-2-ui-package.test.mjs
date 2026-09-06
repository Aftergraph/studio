import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';

const files=[
  'packages/ui/primitives/button.mjs','packages/ui/primitives/icon-button.mjs','packages/ui/primitives/input.mjs','packages/ui/primitives/menu.mjs','packages/ui/primitives/notice.mjs',
  'packages/ui/conversation/turn.mjs','packages/ui/conversation/composer.mjs','packages/ui/conversation/response-status.mjs',
  'packages/ui/work/work-summary.mjs','packages/ui/work/outcome-receipt.mjs','packages/ui/work/artifact.mjs',
  'packages/ui/trust/approval.mjs','packages/ui/trust/need-you.mjs','packages/ui/trust/evidence.mjs','packages/ui/trust/risk.mjs',
  'packages/ui/agents/agent-card.mjs','packages/ui/agents/agent-presence.mjs',
  'packages/ui/system/upstream-service-row.mjs','packages/ui/system/source-truth-badge.mjs','packages/ui/system/event-row.mjs',
];

test('ui package is split into focused semantic modules',()=>{
  for(const path of files)assert.equal(existsSync(new URL(`../${path}`,import.meta.url)),true,path);
});

test('ui barrel is exports-only and contains no component implementations',()=>{
  const barrel=readFileSync(new URL('../packages/ui/index.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(barrel,/export function\s+AG/);
  assert.match(barrel,/export \{/);
});

test('ui modules own no network, persistence, or integration state',()=>{
  for(const path of files){
    if(!existsSync(new URL(`../${path}`,import.meta.url)))continue;
    const src=readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
    assert.doesNotMatch(src,/\bfetch\s*\(|localStorage|api-client|server-store|src\/integrations/);
  }
});
