import { createLiveRuntime, pauseMission, resumeMission, stepMission } from './live-runtime.mjs';

const clone = value => structuredClone(value);

export class MissionRuntimeHub {
  constructor({ store, intervalMs = 1250, onChange = () => {} } = {}) {
    if (!store) throw new Error('store required');
    this.store = store;
    this.intervalMs = Math.max(10, Number(intervalMs) || 1250);
    this.onChange = onChange;
    this.runtimes = new Map();
    this.timers = new Map();
  }

  snapshot() {
    return Object.fromEntries([...this.runtimes.entries()].map(([id, runtime]) => [id, {
      missionId:id,
      status:runtime.status,
      tick:runtime.tick,
      attention:runtime.attention || null,
    }]));
  }

  runtime(missionId) { return this.runtimes.get(missionId) || null; }

  async start(missionId) {
    this.stopTimer(missionId);
    let runtime = createLiveRuntime(this.store.snapshot(), missionId);
    if (runtime.status === 'awaiting_approval') {
      this.runtimes.set(missionId, runtime);
      await this.emit();
      return clone(runtime);
    }
    runtime.status = 'running';
    this.runtimes.set(missionId, runtime);
    this.startTimer(missionId);
    await this.emit();
    return clone(runtime);
  }

  async step(missionId) {
    let runtime = this.runtimes.get(missionId) || createLiveRuntime(this.store.snapshot(), missionId);
    runtime = clone(runtime);
    runtime.state = this.store.snapshot();
    runtime = stepMission(runtime);
    this.runtimes.set(missionId, runtime);
    await this.store.replace(runtime.state);
    await this.emit();
    if (runtime.status === 'verified' || runtime.status === 'awaiting_approval') this.stopTimer(missionId);
    return clone(runtime);
  }

  async pause(missionId) {
    const current = this.runtimes.get(missionId) || createLiveRuntime(this.store.snapshot(), missionId);
    const runtime = pauseMission(current);
    this.runtimes.set(missionId, runtime);
    this.stopTimer(missionId);
    await this.emit();
    return clone(runtime);
  }

  async resume(missionId) {
    const current = this.runtimes.get(missionId) || createLiveRuntime(this.store.snapshot(), missionId);
    const runtime = resumeMission(current);
    this.runtimes.set(missionId, runtime);
    if (runtime.status === 'running') this.startTimer(missionId);
    await this.emit();
    return clone(runtime);
  }

  async reset() {
    this.stopAll();
    this.runtimes.clear();
    await this.emit();
  }

  startTimer(missionId) {
    this.stopTimer(missionId);
    const timer = setInterval(() => {
      this.step(missionId).catch(() => this.stopTimer(missionId));
    }, this.intervalMs);
    timer.unref?.();
    this.timers.set(missionId, timer);
  }

  stopTimer(missionId) {
    const timer = this.timers.get(missionId);
    if (timer) clearInterval(timer);
    this.timers.delete(missionId);
  }

  stopAll() {
    for (const id of this.timers.keys()) this.stopTimer(id);
  }

  async emit() {
    await this.onChange({ state:this.store.snapshot(), runtimes:this.snapshot() });
  }
}
