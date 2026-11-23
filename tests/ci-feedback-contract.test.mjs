import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow=readFileSync(new URL('../.github/workflows/ci.yml',import.meta.url),'utf8');

test('CI cancels superseded pull request runs but never cancels main runs',()=>{
  assert.match(workflow,/^concurrency:\s*$/m);
  assert.ok(workflow.includes("group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}"));
  assert.ok(workflow.includes("cancel-in-progress: ${{ github.event_name == 'pull_request' }}"));
});

test('CI caches only hash-locked pip dependencies for the existing Python runner',()=>{
  assert.match(workflow,/cache: pip/);
  assert.ok(workflow.includes('cache-dependency-path: .github/requirements/ci.txt'));
  assert.ok(workflow.includes('pip install --require-hashes -r .github/requirements/ci.txt'));
});

test('CI speed changes keep the exact existing main and PR release gate intact',()=>{
  assert.match(workflow,/push:\s*branches: \[ main \]/);
  assert.match(workflow,/pull_request:\s*branches: \[ main \]/);
  assert.match(workflow,/name: Monolithic Release Verification \(18 Gates\)/);
  assert.ok(workflow.includes('runs-on: ubuntu-latest'));
  for(const command of ['npm test','npm run verify','npm run verify:platforms','npm run verify:secrets','node scripts/v6_release_verify.mjs']){
    assert.ok(workflow.includes(command),command+' remains required');
  }
  assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
  assert.doesNotMatch(workflow,/retry:/);
});
