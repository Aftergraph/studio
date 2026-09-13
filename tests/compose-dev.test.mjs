import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = path.join(root, 'scripts', 'compose-dev.mjs');

test('compose dev dry-run prints a deterministic device plan without starting services', () => {
  const result = spawnSync(process.execPath, [
    script,
    '--dry-run',
    '--host', '100.64.0.7',
    '--hermes-port', '8643',
    '--studio-port', '8000',
    '--expo-port', '8081',
  ], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Hermes:\s+http:\/\/127\.0\.0\.1:8643/);
  assert.match(result.stdout, /Studio:\s+http:\/\/100\.64\.0\.7:8000/);
  assert.match(result.stdout, /Expo:\s+exp:\/\/100\.64\.0\.7:8081/);
  assert.match(result.stdout, /EXPO_PUBLIC_AFTERGRAPH_API_URL=http:\/\/100\.64\.0\.7:8000/);
  assert.doesNotMatch(result.stdout, /API_SERVER_KEY|AFTERGRAPH_INTENT_HERMES_AUTH/);
});
