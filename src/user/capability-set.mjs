// User capability validation — frozen allowlist, no wildcards.
// ponytail: explicit allowlist over pattern matching; autonomy.* is the only prefix rule.

import { OPERATIONS } from '../institution/institutional-graph.mjs';

const ALLOWLIST = Object.freeze([
  ...OPERATIONS,
  'memory.write',
  'memory.promote',
  'memory.revoke',
  'approval.decide',
  'mission.control',
  'workspace.reset',
  'user.manage',
  'auth.issue',
  'goal.manage',
]);

const PREFIXES = Object.freeze(['autonomy.']);

export function normalizeCapabilities(input) {
  if (!Array.isArray(input)) throw new TypeError('capabilities must be an array');
  
  const seen = new Set();
  const result = [];
  
  for (const cap of input) {
    if (typeof cap !== 'string') throw new TypeError(`invalid_capability: ${cap}`);
    if (cap === '*') throw new Error('invalid_capability: wildcard "*" is forbidden');
    
    const isValid = ALLOWLIST.includes(cap) || PREFIXES.some(prefix => cap.startsWith(prefix));
    if (!isValid) throw new Error(`invalid_capability: ${cap}`);
    
    if (!seen.has(cap)) {
      seen.add(cap);
      result.push(cap);
    }
  }
  
  return Object.freeze(result);
}
