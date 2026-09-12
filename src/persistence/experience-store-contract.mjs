export const EXPERIENCE_STORE_METHODS = Object.freeze([
  'init','read','write','readEvents','pruneEventsThrough',
  'integrityCheck','diagnostics','backup','close',
]);

export function assertExperienceStore(store) {
  if (!store || typeof store !== 'object') throw new TypeError('experience store required');
  for (const method of EXPERIENCE_STORE_METHODS) {
    if (typeof store[method] !== 'function') throw new TypeError(`experience store missing ${method}`);
  }
  return store;
}

export function experienceStoreError(code, message = code, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}
