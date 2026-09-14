// In-memory user store — frozen records, capability validation.
// ponytail: Map over database; persistence belongs to the canonical identity owner.

import { normalizeCapabilities } from './capability-set.mjs';

const users = new Map();
const USER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export function normalizeUserId(id) {
  if (typeof id !== 'string') throw new TypeError('user id required');
  const value = id.trim();
  if (!USER_ID_PATTERN.test(value)) {
    const error = new TypeError('invalid user id');
    error.code = 'invalid_user_id';
    throw error;
  }
  return value;
}

export function createUser({ id, name, role = 'member', workspaceId, capabilities }) {
  const normalizedId = normalizeUserId(id);
  const normalizedCaps = normalizeCapabilities(capabilities || []);
  
  const user = Object.freeze({
    id: normalizedId,
    name: String(name ?? normalizedId),
    role: String(role),
    workspaceId: String(workspaceId || normalizedId),
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
