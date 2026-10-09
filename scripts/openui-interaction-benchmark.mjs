import {
  createInteractionSurface,
  createNativeInteractionRenderer,
  createOpenUIInteractionRenderer,
  benchmarkInteractionRenderer,
} from '../packages/interaction/index.mjs';

const surface = createInteractionSurface({
  id: 'surface:benchmark-needs-you',
  missionId: 'mission:benchmark-1',
  status: 'NEEDS_INPUT',
  title: 'Needs You',
  summary: 'Production deploy is waiting for explicit approval.',
  views: [
    { id: 'status', kind: 'status', title: 'Release', body: 'Verification passed; approval remains.' },
    { id: 'risk', kind: 'notice', title: 'Risk', body: 'Production write with user-visible effects.' },
  ],
  actions: [{
    id: 'approve-deploy', label: 'Approve deploy', capability: 'deploy.production',
    consequence: 'consequential', requiresConfirmation: true,
  }],
  evidence: [{ id: 'ev:release-1', owner: 'works', freshness: 'current', verified: true }],
  metrics: { progress: 0.9, costUsd: 1.24, risk: 'high' },
});
const countApproxTokens = value => Math.ceil(Buffer.byteLength(value, 'utf8') / 4);
const iterations = Number(process.env.AFTERGRAPH_OPENUI_BENCH_ITERATIONS || 100);

const renderers = [createNativeInteractionRenderer(), createOpenUIInteractionRenderer()];
const results = [];
for (const renderer of renderers) {
  const result = await benchmarkInteractionRenderer({
    renderer,
    surface,
    iterations,
    countTokens: countApproxTokens,
  });
  results.push(result);
}

const native = results.find(result => result.renderer === 'native');
const openui = results.find(result => result.renderer === 'openui');
const tokenDeltaPct = native?.tokens
  ? ((openui.tokens - native.tokens) / native.tokens) * 100
  : null;

console.log(JSON.stringify({
  schema: 'aftergraph.interaction-renderer-benchmark/v1',
  tokenMethod: 'approximate UTF-8 bytes / 4; directional only, not publication evidence',
  surfaceId: surface.id,
  iterations,
  results,
  openuiVsNativeTokenDeltaPct: tokenDeltaPct,
}, null, 2));
