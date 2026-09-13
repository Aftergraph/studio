export const DEFAULT_PORTS = Object.freeze({ hermes: 8643, studio: 8000, expo: 8081 });

const IPV4_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const HOST_RE = /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const SENSITIVE_ENV = /^(?:API_SERVER_KEY|AFTERGRAPH_AUTH_SECRET|AFTERGRAPH_INTENT_HERMES_(?:AUTH|KEY|MODEL|REASONING|TIMEOUT_MS|PROVIDER))$/;

function composeError(code, detail = '') {
  const error = new Error(detail ? `${code}: ${detail}` : code);
  error.code = code;
  return error;
}

function validIpv4(value) {
  const parts = String(value).split('.').map(Number);
  return parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255);
}

function validTailscaleIpv4(value) {
  if (!validIpv4(value)) return false;
  const [first, second] = String(value).split('.').map(Number);
  return first === 100 && second >= 64 && second <= 127;
}

export function valueOf(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] && !String(args[index + 1]).startsWith('--')
    ? args[index + 1]
    : fallback;
}

export function parseTailscaleIpv4(output) {
  for (const candidate of String(output ?? '').match(IPV4_RE) || []) {
    if (validTailscaleIpv4(candidate)) return candidate;
  }
  throw composeError('tailscale_ipv4_unavailable', 'tailscale ip -4 returned no 100.64.0.0/10 address');
}

export function resolveDeviceHost({ explicitHost, tailscaleOutput } = {}) {
  const explicit = explicitHost == null ? '' : String(explicitHost).trim();
  if (explicit) {
    if (!validIpv4(explicit) && !HOST_RE.test(explicit)) {
      throw composeError('invalid_compose_host', 'host must be an IPv4 address or hostname');
    }
    return explicit;
  }
  return parseTailscaleIpv4(tailscaleOutput);
}

export const discoverDeviceHost = resolveDeviceHost;

function portValue(input, name) {
  const value = input?.[name];
  if (value == null) return DEFAULT_PORTS[name];
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) throw composeError('invalid_compose_port', `${name} must be an integer between 1 and 65535`);
  const port = Number(text);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw composeError('invalid_compose_port', `${name} must be an integer between 1 and 65535`);
  }
  return port;
}

export function resolvePorts(input = {}) {
  const ports = {
    hermes: portValue(input, 'hermes'),
    studio: portValue(input, 'studio'),
    expo: portValue(input, 'expo'),
  };
  if (new Set(Object.values(ports)).size !== Object.values(ports).length) {
    throw composeError('compose_ports_must_be_distinct', 'Hermes, Studio and Expo ports must be distinct');
  }
  return ports;
}

export function parsePortOwners(output, port) {
  const wanted = Number(port);
  if (!Number.isInteger(wanted)) return [];
  const owners = new Set();
  for (const line of String(output ?? '').split(/\r?\n/)) {
    if (!/\b(?:LISTENING|LISTEN)\b/i.test(line)) continue;
    const endpointMatches = [...line.matchAll(/(?:\[?[^\s\]:]+\]?|\*)\s*:\s*(\d+)\b/g)];
    if (!endpointMatches.some(match => Number(match[1]) === wanted)) continue;
    const pid = line.match(/(?:pid[=:\s]+|\s)(\d+)\s*$/i)?.[1]
      || line.match(/\bpid[=:](\d+)\b/i)?.[1];
    if (pid) owners.add(Number(pid));
  }
  return [...owners].sort((a, b) => a - b);
}

export function parsePortStatus(output, port) {
  const wanted = Number(port);
  let occupied = false;
  for (const line of String(output ?? '').split(/\r?\n/)) {
    if (!/\b(?:LISTENING|LISTEN)\b/i.test(line)) continue;
    const endpointMatches = [...line.matchAll(/(?:\[?[^\s\]:]+\]?|\*)\s*:\s*(\d+)\b/g)];
    if (endpointMatches.some(match => Number(match[1]) === wanted)) occupied = true;
  }
  return { occupied, ownerPids: parsePortOwners(output, wanted) };
}

export function assertComposeHermesGateway({ statusOutput = '', portStatus = {}, port = DEFAULT_PORTS.hermes } = {}) {
  const match = String(statusOutput).match(/Gateway is running \(PID:\s*(\d+)\)/i);
  if (!match) {
    throw composeError('hermes_compose_gateway_unavailable', 'compose profile gateway is not running');
  }
  const pid = Number(match[1]);
  const owners = (portStatus.ownerPids ?? (portStatus.ownerPid == null ? [] : [portStatus.ownerPid])).map(Number);
  if (!portStatus.occupied || owners.length === 0 || owners.some(owner => owner !== pid)) {
    throw composeError('hermes_compose_gateway_port_mismatch', 'compose gateway PID ' + pid + ' does not exclusively own port ' + port);
  }
  return pid;
}

export function assertComposePortOwner({ label, port, ownerPid, ownerPids, occupied = false, allowedPids = [] } = {}) {
  const allowed = new Set((allowedPids || []).map(Number));
  const owners = ownerPids == null ? (ownerPid == null ? [] : [ownerPid]) : ownerPids;
  if (occupied && owners.length === 0) {
    throw composeError('port_in_use_by_unrelated_process', `${label || 'Compose'} port ${port} has an unknown owner`);
  }
  for (const candidate of owners) {
    const pid = Number(candidate);
    if (!Number.isInteger(pid) || !allowed.has(pid)) {
      throw composeError('port_in_use_by_unrelated_process', `${label || 'Compose'} port ${port} is owned by PID ${candidate}`);
    }
  }
}

export const assertPortOwnership = assertComposePortOwner;

export function assertPortsAvailable(ports, ownerLookup, allowedPids = []) {
  for (const [name, port] of Object.entries(ports)) {
    const result = ownerLookup(port) || {};
    assertPortOwnership({
      label: name[0].toUpperCase() + name.slice(1),
      port,
      occupied: Boolean(result.occupied),
      ownerPids: result.ownerPids ?? (result.ownerPid == null ? [] : [result.ownerPid]),
      allowedPids,
    });
  }
}

export function buildExpoEnv(baseEnv = process.env, apiUrl) {
  const env = {};
  for (const [key, value] of Object.entries(baseEnv || {})) {
    if (key.startsWith('EXPO_PUBLIC_') || SENSITIVE_ENV.test(key)) continue;
    env[key] = String(value);
  }
  env.EXPO_PUBLIC_AFTERGRAPH_API_URL = String(apiUrl);
  return env;
}

export function buildStudioEnv(baseEnv = process.env, plan) {
  const env = { ...(baseEnv || {}) };
  env.PORT = String(plan.studioPort);
  env.HOST = '0.0.0.0';
  env.AFTERGRAPH_INTENT_HERMES_URL = plan.hermesUrl;
  return env;
}

export function validateHermesLoopback(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw composeError('hermes_endpoint_must_be_loopback', 'Hermes URL is not a valid URL');
  }
  if (parsed.protocol !== 'http:' || parsed.hostname !== '127.0.0.1') {
    throw composeError('hermes_endpoint_must_be_loopback', 'Hermes Compose API must use http://127.0.0.1');
  }
  return parsed.href.replace(/\/$/, '');
}

export function buildComposePlan(args = [], { tailscaleOutput = '' } = {}) {
  const explicitHost = valueOf(args, '--host', undefined);
  const host = resolveDeviceHost({ explicitHost, tailscaleOutput });
  const ports = resolvePorts({
    hermes: valueOf(args, '--hermes-port', undefined),
    studio: valueOf(args, '--studio-port', undefined),
    expo: valueOf(args, '--expo-port', undefined),
  });
  const hermesUrl = validateHermesLoopback(`http://127.0.0.1:${ports.hermes}`);
  const studioUrl = `http://${host}:${ports.studio}`;
  return {
    dryRun: args.includes('--dry-run'),
    host,
    ...ports,
    hermesPort: ports.hermes,
    studioPort: ports.studio,
    expoPort: ports.expo,
    hermesUrl,
    hermesHealthUrl: `${hermesUrl}/healthz`,
    studioUrl,
    studioHealthUrl: `http://127.0.0.1:${ports.studio}/healthz`,
    expoUrl: `exp://${host}:${ports.expo}`,
    expoHealthUrl: `http://127.0.0.1:${ports.expo}`,
    mobileApiEnv: `EXPO_PUBLIC_AFTERGRAPH_API_URL=${studioUrl}`,
  };
}
