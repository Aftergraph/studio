import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createInitialState } from './state.mjs';

const clone = value => structuredClone(value);

export class WorkspaceStateStore {
  constructor({ stateFile = null, initialState = createInitialState() } = {}) {
    this.stateFile = stateFile ? path.resolve(stateFile) : null;
    this.seed = clone(initialState);
    this.state = clone(initialState);
    this.loaded = false;
    this.writeChain = Promise.resolve();
  }

  async init() {
    if (this.loaded) return this;
    this.loaded = true;
    if (!this.stateFile) return this;
    try {
      const parsed = JSON.parse(await readFile(this.stateFile, 'utf8'));
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.missions)) this.state = parsed;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return this;
  }

  snapshot() { return clone(this.state); }

  // ponytail: drain lets server close await in-flight persists so test
  // teardown never rmdirs a directory with pending per-user state writes.
  drain() { return this.writeChain.catch(() => {}); }

  async replace(nextState) {
    this.state = clone(nextState);
    await this.persist();
    return this.snapshot();
  }

  async mutate(mutator) {
    const next = clone(this.state);
    const result = await mutator(next);
    this.state = clone(result ?? next);
    await this.persist();
    return this.snapshot();
  }

  async reset() {
    this.state = clone(this.seed);
    await this.persist();
    return this.snapshot();
  }

  async persist() {
    if (!this.stateFile) return;
    const body = `${JSON.stringify(this.state, null, 2)}\n`;
    const target = this.stateFile;
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(path.dirname(target), { recursive:true });
      const tmp = `${target}.${process.pid}.tmp`;
      await writeFile(tmp, body, 'utf8');
      await rename(tmp, target);
    });
    await this.writeChain;
  }
}
