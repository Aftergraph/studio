export function valueOf(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

export function buildComposePlan(args) {
  const host = valueOf(args, '--host', '127.0.0.1');
  const hermesPort = Number(valueOf(args, '--hermes-port', '8643'));
  const studioPort = Number(valueOf(args, '--studio-port', '8000'));
  const expoPort = Number(valueOf(args, '--expo-port', '8081'));
  const hermesUrl = `http://127.0.0.1:${hermesPort}`;
  const studioUrl = `http://${host}:${studioPort}`;
  return {
    dryRun: args.includes('--dry-run'),
    host,
    hermesPort,
    studioPort,
    expoPort,
    hermesUrl,
    studioUrl,
    expoUrl: `exp://${host}:${expoPort}`,
    mobileApiEnv: `EXPO_PUBLIC_AFTERGRAPH_API_URL=${studioUrl}`,
  };
}
