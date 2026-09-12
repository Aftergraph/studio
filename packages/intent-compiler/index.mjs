export { normalizeIntentIR, validateIntentIR, INTENT_SCHEMA, ARTIFACT_KINDS, PERSISTENCE } from './schema.mjs';

import { normalizeIntentIR, validateIntentIR } from './schema.mjs';

export function createIntentIR(candidate={}) {
  return normalizeIntentIR(candidate);
}
