import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(
  new URL('../.github/workflows/ci.yml', import.meta.url),
  'utf8',
);

test('CI installs locked Compose Expo dependencies before workspace verification', () => {
  const installAt = workflow.indexOf('name: Install Compose Expo dependencies');
  const verifyAt = workflow.indexOf('name: Run Workspace Contract & Drift Verification');
  const installBlock = workflow.slice(installAt, verifyAt);

  assert.notEqual(installAt, -1, 'missing Compose Expo dependency install step');
  assert.ok(installAt < verifyAt, 'Expo install must precede workspace verification');
  assert.match(installBlock, /working-directory:\s*platforms\/expo/);
  assert.match(installBlock, /run:\s*npm ci/);
});
