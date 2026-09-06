import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { journeyNames } from './v6-cross-system-invariants.test.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

const REQUIRED_BROWSER_GATES = ['now', 'research', 'agents', 'control', 'connect', 'system', 'search', 'mobile', 'reduced-motion'];

test('V6 release contract requires all browser domains and invariant artifacts', () => {
  for (const name of ['now', 'research', 'agents', 'control', 'connect', 'system', 'search', 'mobile', 'reduced-motion']) {
    assert.ok(REQUIRED_BROWSER_GATES.includes(name));
  }
  assert.ok(existsSync(path.join(root, 'contracts/v6/release-invariants.json')));
  assert.ok(existsSync(path.join(root, 'contracts/v6/integration-manifest.schema.json')));
  assert.ok(existsSync(path.join(root, 'contracts/v6/object-envelope.schema.json')));
  assert.ok(existsSync(path.join(root, 'contracts/v6/relation-vocabulary.json')));
  assert.ok(existsSync(path.join(root, 'contracts/v6/core-object-types.json')));

  // Locked file structure verification from V6 Implementation Plan
  const lockedFiles = [
    'src/research/projection.mjs',
    'src/research/promotion-proposal.mjs',
    'src/now/projection.mjs',
    'src/composer/resolver.mjs',
    'server/search-routes.mjs',
    'server/research-routes.mjs',
    'server/now-routes.mjs'
  ];
  for (const f of lockedFiles) {
    assert.ok(existsSync(path.join(root, f)), `Locked plan file ${f} must exist`);
  }
});

test('V6 release contract enforces package version 6.0.0 and complete release metadata', () => {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '6.0.0');
  assert.ok(pkg.description.includes('V6'));
  assert.ok(pkg.scripts['verify:release']);
  assert.ok(pkg.scripts['verify:a11y']);
  assert.ok(pkg.scripts['verify:browser:v6']);
  assert.ok(pkg.scripts['verify:release'].includes('verify:browser:v6'));
});

test('V6 release contract validates release invariants schema and exact test coverage', () => {
  const inv = JSON.parse(readFileSync(path.join(root, 'contracts/v6/release-invariants.json'), 'utf8'));
  assert.equal(inv.schema, 'aftergraph.release-invariants/v1');
  assert.equal(inv.v6_invariants.length, 12);
  assert.equal(inv.v5_2_invariants.length, 8);
  assert.equal(inv.e2e_journeys.length, 5);

  // Exact-match verification against tests/v6-cross-system-invariants.test.mjs
  const testContent = readFileSync(path.join(root, 'tests/v6-cross-system-invariants.test.mjs'), 'utf8');
  for (const invariantName of inv.v6_invariants) {
    assert.ok(testContent.includes(`test('${invariantName}'`), `Invariant '${invariantName}' must be explicitly tested by exact name in v6-cross-system-invariants.test.mjs`);
  }

  // Exact-match verification for registered E2E journeys
  const registeredJourneys = journeyNames();
  for (const journey of inv.e2e_journeys) {
    assert.ok(registeredJourneys.includes(journey), `Journey '${journey}' must be registered in journeyNames()`);
  }
});
