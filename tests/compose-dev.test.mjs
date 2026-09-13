import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const script = path.join(root, 'scripts', 'compose-dev.mjs');
const lib = await import('../scripts/compose-dev-lib.mjs');

test('compose dev dry-run prints a deterministic device plan without starting services', () => {
  const result = spawnSync(process.execPath, [
    script, '--dry-run', '--host', '100.64.0.7',
    '--hermes-port', '8643', '--studio-port', '8000', '--expo-port', '8081',
  ], { cwd: root, encoding: 'utf8' });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Hermes:\s+http:\/\/127\.0\.0\.1:8643/);
  assert.match(result.stdout, /Studio:\s+http:\/\/100\.64\.0\.7:8000/);
  assert.match(result.stdout, /Expo:\s+exp:\/\/100\.64\.0\.7:8081/);
  assert.match(result.stdout, /EXPO_PUBLIC_AFTERGRAPH_API_URL=http:\/\/100\.64\.0\.7:8000/);
  assert.doesNotMatch(result.stdout, /API_SERVER_KEY|AFTERGRAPH_INTENT_HERMES_AUTH/);
});

test('Tailscale IPv4 discovery prefers explicit host and otherwise parses current CLI output', () => {
  assert.equal(typeof lib.resolveDeviceHost, 'function');
  assert.equal(lib.resolveDeviceHost({ explicitHost: '192.168.1.9', tailscaleOutput: '100.70.80.90\n' }), '192.168.1.9');
  assert.equal(lib.resolveDeviceHost({ tailscaleOutput: '100.70.80.90\n' }), '100.70.80.90');
  assert.throws(() => lib.resolveDeviceHost({ tailscaleOutput: '' }), /tailscale_ipv4_unavailable/);
});

test('port resolution uses stable defaults and rejects collisions', () => {
  assert.equal(typeof lib.resolvePorts, 'function');
  assert.deepEqual(lib.resolvePorts({}), { hermes: 8643, studio: 8000, expo: 8081 });
  assert.deepEqual(lib.resolvePorts({ studio: '8010', expo: '8082' }), { hermes: 8643, studio: 8010, expo: 8082 });
  assert.throws(() => lib.resolvePorts({ studio: '8081', expo: '8081' }), /compose_ports_must_be_distinct/);
  assert.throws(() => lib.resolvePorts({ studio: '0' }), /invalid_compose_port/);
});

test('port ownership fails closed for an unrelated process', () => {
  assert.equal(typeof lib.assertComposePortOwner, 'function');
  assert.doesNotThrow(() => lib.assertComposePortOwner({ label: 'Studio', port: 8000, ownerPid: null, allowedPids: [] }));
  assert.doesNotThrow(() => lib.assertComposePortOwner({ label: 'Hermes', port: 8643, ownerPid: 10, allowedPids: [10] }));
  assert.throws(
    () => lib.assertComposePortOwner({ label: 'Studio', port: 8000, ownerPid: 20, allowedPids: [10] }),
    /port_in_use_by_unrelated_process/,
  );
  assert.throws(
    () => lib.assertPortOwnership({ label: 'Expo', port: 8081, occupied: true, ownerPid: null, allowedPids: [] }),
    /port_in_use_by_unrelated_process/,
  );
});

test('compose plan discovers the device host and keeps Hermes loopback-only', () => {
  const plan = lib.buildComposePlan(['--dry-run'], { tailscaleOutput: '100.64.0.7\\n' });
  assert.equal(plan.host, '100.64.0.7');
  assert.equal(plan.hermesUrl, 'http://127.0.0.1:8643');
  assert.equal(plan.studioUrl, 'http://100.64.0.7:8000');
  assert.equal(plan.expoUrl, 'exp://100.64.0.7:8081');
  assert.deepEqual(
    { hermesPort: plan.hermesPort, studioPort: plan.studioPort, expoPort: plan.expoPort },
    { hermesPort: 8643, studioPort: 8000, expoPort: 8081 },
  );
});

test('Expo environment contains only the public Aftergraph API variable', () => {
  const env = lib.buildExpoEnv({
    PATH: 'path',
    API_SERVER_KEY: 'server-secret',
    AFTERGRAPH_INTENT_HERMES_AUTH: 'hermes-secret',
    EXPO_PUBLIC_OLD_URL: 'http://wrong',
  }, 'http://100.64.0.7:8000');
  assert.equal(env.EXPO_PUBLIC_AFTERGRAPH_API_URL, 'http://100.64.0.7:8000');
  assert.deepEqual(Object.keys(env).filter(key => key.startsWith('EXPO_PUBLIC_')), ['EXPO_PUBLIC_AFTERGRAPH_API_URL']);
  assert.equal(env.API_SERVER_KEY, undefined);
  assert.equal(env.AFTERGRAPH_INTENT_HERMES_AUTH, undefined);
  const studioEnv = lib.buildStudioEnv({ API_SERVER_KEY: 'server-secret' }, {
    studioPort: 8000,
    host: '100.64.0.7',
    hermesUrl: 'http://127.0.0.1:8643',
  });
  assert.equal(studioEnv.HOST, '0.0.0.0');
  assert.equal(studioEnv.AFTERGRAPH_INTENT_HERMES_URL, 'http://127.0.0.1:8643');
});

test('port owner parser recognizes only listeners on the requested port', () => {
  assert.deepEqual(
    lib.parsePortOwners('TCP    0.0.0.0:8000    0.0.0.0:0    LISTENING    1234\nTCP    0.0.0.0:8081    0.0.0.0:0    LISTENING    5678\n', 8000),
    [1234],
  );
});


test('Compose Hermes profile status must identify the gateway PID that owns the configured port', () => {
  assert.equal(typeof lib.assertComposeHermesGateway, 'function');
  assert.equal(
    lib.assertComposeHermesGateway({
      statusOutput: '✓ Gateway is running (PID: 54868)\n',
      portStatus: { occupied: true, ownerPids: [54868] },
      port: 8643,
    }),
    54868,
  );
});

test('Compose Hermes validation fails closed when the profile is stopped or another process owns the port', () => {
  assert.throws(
    () => lib.assertComposeHermesGateway({ statusOutput: 'Gateway is not running\n', portStatus: { occupied: false, ownerPids: [] }, port: 8643 }),
    /hermes_compose_gateway_unavailable/,
  );
  assert.throws(
    () => lib.assertComposeHermesGateway({ statusOutput: 'Gateway is running (PID: 54868)\n', portStatus: { occupied: true, ownerPids: [50136] }, port: 8643 }),
    /hermes_compose_gateway_port_mismatch/,
  );
});