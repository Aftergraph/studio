import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const QA_BUNDLERS = [
  'scripts/browser_smoke.py',
  'scripts/browser_smoke_v5.py',
  'scripts/capture_v5_2_visuals.py',
  'scripts/fullstack_bridge_smoke.py',
  'scripts/fullstack_bridge_smoke_v5.py',
  'scripts/polyrepo_bridge_smoke_v5.py',
  'scripts/v5_2_browser_qa.py',
];

test('QA browser bundles include billing fixtures before canonical state', () => {
  for (const path of QA_BUNDLERS) {
    const source = fs.readFileSync(path, 'utf8');
    const fixtures = source.indexOf("'src/billing/fixtures.mjs'");
    const state = source.indexOf("'src/state.mjs'");
    assert.ok(fixtures >= 0, `${path} must include billing fixtures`);
    assert.ok(fixtures < state, `${path} must load billing fixtures before canonical state`);
  }
});
