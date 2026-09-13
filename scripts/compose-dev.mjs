#!/usr/bin/env node

function valueOf(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const host = valueOf(args, '--host', '127.0.0.1');
const hermesPort = Number(valueOf(args, '--hermes-port', '8643'));
const studioPort = Number(valueOf(args, '--studio-port', '8000'));
const expoPort = Number(valueOf(args, '--expo-port', '8081'));
const hermesUrl = `http://127.0.0.1:${hermesPort}`;
const studioUrl = `http://${host}:${studioPort}`;
const expoUrl = `exp://${host}:${expoPort}`;

if (!dryRun) {
  console.error('compose-dev currently requires --dry-run');
  process.exit(2);
}

console.log('Aftergraph Compose device plan');
console.log(`Hermes: ${hermesUrl}`);
console.log(`Studio: ${studioUrl}`);
console.log(`Expo:   ${expoUrl}`);
console.log(`EXPO_PUBLIC_AFTERGRAPH_API_URL=${studioUrl}`);
