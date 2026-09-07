// In-memory user store — frozen records, capability validation.
// ponytail: Map over database; persistence belongs to the canonical identity owner.

import { normalizeCapabilities } from './capability-set.mjs';

const users = new Map();

export function createUser({ id, name, role, capabilities }) {
  if (!id) throw new TypeError('user requires id');
  if (!name) throw new TypeError('user requires name');
  if (!role) throw new TypeError('user requires role');
  
  const normalizedCaps = normalizeCapabilities(capabilities || []);
  
  const user = Object.freeze({
    id: String(id),
    name: String(name),
    role: String(role),
    capabilities: normalizedCaps,
  });
  
  users.set(user.id, user);
  return user;
}

export function getUser(id) {
  return users.get(String(id));
}

export function updateCapabilities(id, capabilities) {
  const user = users.get(String(id));
  if (!user) throw new Error(`user not found: ${id}`);
  
  const normalizedCaps = normalizeCapabilities(capabilities);
  
  const updated = Object.freeze({
    ...user,
    capabilities: normalizedCaps,
  });
  
  users.set(user.id, updated);
  return updated;
}
