import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WorkspaceStateStore } from '../src/server-store.mjs';

test('WorkspaceStateStore serializes concurrent read-modify-write mutations', async () => {
  const store = new WorkspaceStateStore({
    initialState: { missions: [], counter: 0 },
  });

  await Promise.all([
    store.mutate(async (draft) => {
      await new Promise(resolve => setImmediate(resolve));
      draft.counter += 1;
      return draft;
    }),
    store.mutate(async (draft) => {
      await new Promise(resolve => setImmediate(resolve));
      draft.counter += 1;
      return draft;
    }),
  ]);

  assert.equal(store.snapshot().counter, 2);
});

test('WorkspaceStateStore persists the serialized final state after concurrent mutations', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'aftergraph-store-concurrency-'));
  const stateFile = join(dir, 'state.json');
  try {
    const store = new WorkspaceStateStore({
      stateFile,
      initialState: { missions: [], counter: 0 },
    });
    await Promise.all([
      store.mutate(async (draft) => {
        await new Promise(resolve => setImmediate(resolve));
        draft.counter += 1;
        return draft;
      }),
      store.mutate(async (draft) => {
        await new Promise(resolve => setImmediate(resolve));
        draft.counter += 1;
        return draft;
      }),
    ]);
    assert.equal(JSON.parse(await readFile(stateFile, 'utf8')).counter, 2);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
