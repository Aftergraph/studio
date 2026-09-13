#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  assertComposeHermesGateway,
  assertPortsAvailable,
  buildComposePlan,
  buildExpoEnv,
  buildStudioEnv,
  parsePortStatus,
  validateHermesLoopback,
} from './compose-dev-lib.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.dirname(root);
const expoRoot = path.join(workspaceRoot, 'platforms', 'expo');

function commandError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function readTailscaleIpv4() {
  const command = process.platform === 'win32' ? 'tailscale.exe' : 'tailscale';
  const result = spawnSync(command, ['ip', '-4'], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw commandError('tailscale_ipv4_unavailable');
  return result.stdout;
}

function inspectPort(port) {
  const command = process.platform === 'win32' ? 'netstat.exe' : 'netstat';
  const result = spawnSync(command, ['-ano'], { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0) throw commandError('port_inspection_failed');
  return parsePortStatus(result.stdout, port);
}

function printPlan(plan) {
  console.log('Aftergraph Compose device plan');
  console.log(`Hermes: ${plan.hermesUrl}`);
  console.log(`Studio: ${plan.studioUrl}`);
  console.log(`Expo:   ${plan.expoUrl}`);
  console.log(plan.mobileApiEnv);
}

async function fetchHealth(url, { headers = {}, accepts = response => response.ok } = {}) {
  try {
    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(2_000),
    });
    return accepts(response);
  } catch {
    return false;
  }
}

async function waitForHealth(url, options = {}) {
  const attempts = options.attempts ?? 60;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await fetchHealth(url, options)) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw commandError(`${options.label || 'service'}_health_unavailable`);
}

async function validateHermes(plan) {
  const command = process.platform === 'win32' ? 'hermes.exe' : 'hermes';
  const status = spawnSync(command, ['--profile', 'compose', 'gateway', 'status'], { encoding: 'utf8', windowsHide: true });
  if (status.error || status.status !== 0) throw commandError('hermes_compose_gateway_unavailable');
  assertComposeHermesGateway({
    statusOutput: status.stdout,
    portStatus: inspectPort(plan.hermesPort),
    port: plan.hermesPort,
  });
  const baseUrl = validateHermesLoopback(plan.hermesUrl);
  const auth = process.env.AFTERGRAPH_INTENT_HERMES_AUTH || process.env.AFTERGRAPH_INTENT_HERMES_KEY || process.env.API_SERVER_KEY;
  const headers = auth ? { authorization: auth.startsWith('Bearer ') ? auth : `Bearer ${auth}` } : {};
  const paths = ['/healthz', '/health', '/v1/models'];
  for (const suffix of paths) {
    if (await fetchHealth(`${baseUrl}${suffix}`, { headers })) return;
  }
  throw commandError('hermes_compose_api_unavailable');
}

function stopChild(child) {
  if (!child || child.killed) return;
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
  } else {
    child.kill();
  }
}

function startChild(label, command, args, cwd, env, children) {
  const child = spawn(command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  // Drain output without forwarding it: server logs may contain credentials.
  child.stdout?.on('data', () => {});
  child.stderr?.on('data', () => {});
  child.on('error', () => {});
  children.add(child);
  child.once('exit', () => {
    if (children.has(child) && !children.shuttingDown) {
      children.shuttingDown = true;
      for (const running of children) {
        if (running !== child) stopChild(running);
      }
      process.exitCode = 1;
    }
  });
  return child;
}

function stopChildren(children) {
  children.shuttingDown = true;
  for (const child of children) stopChild(child);
  children.clear();
}

async function runDeviceStack(plan) {
  await validateHermes(plan);

  // Validate all bind ports before starting either Compose-owned child.
  assertPortsAvailable(
    { studio: plan.studioPort, expo: plan.expoPort },
    port => inspectPort(port),
    [],
  );

  const children = new Set();
  const onSignal = () => stopChildren(children);
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    const studio = startChild(
      'Studio',
      process.execPath,
      [path.join(workspaceRoot, 'server.mjs')],
      workspaceRoot,
      buildStudioEnv(process.env, plan),
      children,
    );
    await waitForHealth(plan.studioHealthUrl, { label: 'studio' });

    const expoCli = path.join(expoRoot, 'node_modules', 'expo', 'bin', 'cli');
    const expoCommand = existsSync(expoCli)
      ? process.execPath
      : (process.platform === 'win32' ? 'npx.cmd' : 'npx');
    const expoArgs = existsSync(expoCli)
      ? [expoCli, 'start', '--lan', '--port', String(plan.expoPort)]
      : ['--no-install', 'expo', 'start', '--lan', '--port', String(plan.expoPort)];
    const expo = startChild(
      'Expo',
      expoCommand,
      expoArgs,
      expoRoot,
      buildExpoEnv(process.env, plan.studioUrl),
      children,
    );
    await waitForHealth(plan.expoHealthUrl, {
      label: 'expo',
      accepts: response => response.status >= 200 && response.status < 500,
    });

    console.log('Aftergraph Compose device stack');
    console.log(`Hermes: ${plan.hermesUrl}`);
    console.log(`Studio: ${plan.studioUrl}`);
    console.log(`Expo:   ${plan.expoUrl}`);
    console.log(plan.mobileApiEnv);
    console.log('Health: Hermes=ok Studio=ok Expo=ok');

    await new Promise(resolve => {
      studio.once('exit', resolve);
      expo.once('exit', resolve);
    });
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    stopChildren(children);
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--help')) {
    console.log('Usage: npm run compose:dev [--dry-run] [--host HOST] [--hermes-port PORT] [--studio-port PORT] [--expo-port PORT]');
    return;
  }
  const tailscaleOutput = args.includes('--host') ? '' : readTailscaleIpv4();
  const plan = buildComposePlan(args, { tailscaleOutput });
  if (plan.dryRun) {
    printPlan(plan);
    return;
  }
  await runDeviceStack(plan);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(error?.code || 'compose_dev_failed');
    process.exitCode = 2;
  });
}
