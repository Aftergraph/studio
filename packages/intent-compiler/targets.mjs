export const TARGETS = new Set([
  'friday.chatgpt',
  'anthropic.claude-code',
  'openai.codex',
  'aftergraph.hermes',
  'generic',
]);
function hintedTargets(ir) {
  return (ir?.targetHints || []).filter(target => TARGETS.has(target));
}

export function classifyTarget(ir={}) {
  const hints = hintedTargets(ir);
  if (hints.length) {
    return {
      target: hints[0],
      confidence: 0.95,
      reasonCodes: ['explicit-target-hint'],
      alternatives: hints.slice(1),
    };
  }
  if (ir?.artifact?.kind === 'automation' && ir?.artifact?.persistence === 'durable') {
    return {
      target: 'aftergraph.hermes',
      confidence: 0.85,
      reasonCodes: ['durable-automation'],
      alternatives: ['generic'],
    };
  }

  return {
    target: 'generic',
    confidence: 0.5,
    reasonCodes: [],
    alternatives: [],
  };
}
