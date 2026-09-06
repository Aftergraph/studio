/**
 * Research OS — Surface Registry (V6.4)
 *
 * Typed surface definitions for the 5 research object types.
 * All surfaces are owned by 'isr'. None carry runtime authority.
 * promotable=true means a claim/evidence can enter the promotion pipeline.
 */

const SCHEMAS = {
  study: {
    authority: 'isr',
    promotable: false,
    fields: { id: 'required', title: 'required', status: 'required', programs: 'optional' },
  },
  experiment: {
    authority: 'isr',
    promotable: false,
    fields: { id: 'required', title: 'required', status: 'required', studyId: 'optional', method: 'optional' },
  },
  claim: {
    authority: 'isr',
    promotable: true,
    fields: { id: 'required', title: 'required', status: 'required', evidenceIds: 'optional' },
  },
  evidence: {
    authority: 'isr',
    promotable: true,
    fields: { id: 'required', method: 'required', verified: 'required', limitations: 'optional' },
  },
  paper: {
    authority: 'isr',
    promotable: false,
    fields: { id: 'required', title: 'required', status: 'required', doi: 'optional' },
  },
};

/** @type {ReadonlyMap<string, object>} */
export const RESEARCH_SURFACES = new Map(Object.entries(SCHEMAS));

/** @returns {object} frozen schema */
export function getSurfaceSchema(surface) {
  const s = SCHEMAS[surface];
  if (!s) throw new TypeError(`unknown research surface: ${surface}`);
  return s;
}

/**
 * Create a typed, frozen research surface record.
 * Validates required fields per schema. Enforces no runtime authority.
 */
export function createResearchSurface(surface, data = {}) {
  const schema = getSurfaceSchema(surface);
  for (const [field, req] of Object.entries(schema.fields)) {
    if (req === 'required' && (data[field] === undefined || data[field] === null)) {
      throw new TypeError(`${field} required for research surface '${surface}'`);
    }
  }
  return Object.freeze({
    surface,
    authority: schema.authority,
    runtimeAuthority: [],
    promotable: schema.promotable,
    ...structuredClone(data),
  });
}
