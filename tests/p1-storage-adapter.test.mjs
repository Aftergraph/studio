import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorageAdapter } from '../src/storage-adapter.mjs';

function createMemoryStorage() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: (key) => { store.delete(key); },
  };
}

test('load returns null when storage is empty', () => {
  const adapter = createStorageAdapter({ storage: createMemoryStorage(), key: 'k', version: 1 });
  assert.equal(adapter.load(), null);
});

test('load returns null and does not throw on corrupt JSON', () => {
  const storage = createMemoryStorage();
  storage.setItem('k', '{not valid json');
  const adapter = createStorageAdapter({ storage, key: 'k', version: 1 });
  assert.equal(adapter.load(), null);
});

test('load returns null when envelope version mismatches and no migrate provided', () => {
  const storage = createMemoryStorage();
  storage.setItem('k', JSON.stringify({ version: 99, savedAt: '2026-01-01T00:00:00Z', state: { x: 1 } }));
  const adapter = createStorageAdapter({ storage, key: 'k', version: 1 });
  assert.equal(adapter.load(), null);
});

test('save/load roundtrip preserves state with versioned envelope', () => {
  const storage = createMemoryStorage();
  const adapter = createStorageAdapter({ storage, key: 'k', version: 2 });
  const payload = { missions: [{ id: 'm1' }], user: { id: 'u1' } };
  adapter.save(payload);

  const raw = JSON.parse(storage.getItem('k'));
  assert.equal(raw.version, 2);
  assert.ok(raw.savedAt);
  assert.deepEqual(raw.state, payload);

  const loaded = adapter.load();
  assert.deepEqual(loaded, payload);
});

test('version mismatch invokes migrate and returns migrated state', () => {
  const storage = createMemoryStorage();
  storage.setItem('k', JSON.stringify({ version: 1, savedAt: '2026-01-01T00:00:00Z', state: { oldField: 'x' } }));
  const migrate = (oldState, fromVersion) => {
    assert.equal(fromVersion, 1);
    return { newField: oldState.oldField };
  };
  const adapter = createStorageAdapter({ storage, key: 'k', version: 2, migrate });
  const loaded = adapter.load();
  assert.deepEqual(loaded, { newField: 'x' });
});

test('migrate returning null causes load to return null', () => {
  const storage = createMemoryStorage();
  storage.setItem('k', JSON.stringify({ version: 1, savedAt: '2026-01-01T00:00:00Z', state: {} }));
  const adapter = createStorageAdapter({ storage, key: 'k', version: 2, migrate: () => null });
  assert.equal(adapter.load(), null);
});

test('save does not throw when storage.setItem fails', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
  const adapter = createStorageAdapter({ storage, key: 'k', version: 1 });
  assert.doesNotThrow(() => adapter.save({ a: 1 }));
});
