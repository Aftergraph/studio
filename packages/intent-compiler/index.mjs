export { normalizeIntentIR, validateIntentIR, INTENT_SCHEMA, ARTIFACT_KINDS, PERSISTENCE } from './schema.mjs';
export { classifyTarget, TARGETS } from './targets.mjs';
export { renderIntent } from './renderers.mjs';
export { refineIntent, REFINEMENT_MODES } from './refine.mjs';

import { normalizeIntentIR } from './schema.mjs';

export function createIntentIR(candidate={}) {
  return normalizeIntentIR(candidate);
}
