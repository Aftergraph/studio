/**
 * Versioneret storage-adapter med injicerbart storage-interface.
 * ponytail: ingen ekstra abstraktioner; kun envelope + migrate.
 */
export function createStorageAdapter({ storage, key, version, migrate }) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('storage must implement getItem/setItem');
  }
  if (!key || typeof key !== 'string') throw new TypeError('key must be a non-empty string');
  if (!Number.isInteger(version) || version < 1) throw new TypeError('version must be a positive integer');

  function load() {
    let raw;
    try {
      raw = storage.getItem(key);
    } catch {
      return null;
    }
    if (raw == null) return null;

    let envelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      return null;
    }
    if (!envelope || typeof envelope !== 'object') return null;
    if (!Number.isInteger(envelope.version)) return null;

    if (envelope.version === version) {
      return envelope.state ?? null;
    }
    if (typeof migrate === 'function') {
      try {
        const migrated = migrate(envelope.state, envelope.version);
        return migrated ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }

  function save(state) {
    const envelope = { version, savedAt: new Date().toISOString(), state };
    try {
      storage.setItem(key, JSON.stringify(envelope));
    } catch {
      // ponytail: fail lukket — localStorage kan fejle (quota, privatliv)
    }
  }

  return { load, save };
}
