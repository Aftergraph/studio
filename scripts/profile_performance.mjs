#!/usr/bin/env node
/**
 * Performance Profiler for Aftergraph Studio
 * Measures bottlenecks: structuredClone, persistence, state size
 */

import { performance } from 'node:perf_hooks';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Import the actual state creation function
import { createInitialState } from '../src/state.mjs';

// ============================================================================
// PROFILING UTILITIES
// ============================================================================

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function formatOpsPerSec(totalMs, count) {
  const opsPerSec = (count / totalMs) * 1000;
  return `${opsPerSec.toFixed(0)} ops/sec`;
}

function measure(name, fn, iterations = 100) {
  const results = [];
  
  // Warmup
  for (let i = 0; i < 5; i++) {
    fn();
  }
  
  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    results.push(end - start);
  }
  
  results.sort((a, b) => a - b);
  const avg = results.reduce((a, b) => a + b, 0) / results.length;
  const p50 = results[Math.floor(results.length * 0.5)];
  const p95 = results[Math.floor(results.length * 0.95)];
  const p99 = results[Math.floor(results.length * 0.99)];
  const min = results[0];
  const max = results[results.length - 1];
  
  return {
    name,
    iterations,
    avg: formatMs(avg),
    p50: formatMs(p50),
    p95: formatMs(p95),
    p99: formatMs(p99),
    min: formatMs(min),
    max: formatMs(max),
    opsPerSec: formatOpsPerSec(avg, 1),
    rawAvg: avg,
    rawP95: p95,
  };
}

// ============================================================================
// STATE PROFILING
// ============================================================================

function profileState() {
  console.log('\n' + '='.repeat(70));
  console.log('STATE PROFILE');
  console.log('='.repeat(70));
  
  const state = createInitialState({ fixtures: true });
  
  // Measure state size
  const stateJson = JSON.stringify(state);
  const stateJsonPretty = JSON.stringify(state, null, 2);
  
  console.log('\nState Object Analysis:');
  console.log(`  Total keys: ${Object.keys(state).length}`);
  console.log(`  Missions: ${state.missions?.length || 0}`);
  console.log(`  Agents: ${state.agents?.length || 0}`);
  console.log(`  Conversations: ${state.conversations?.length || 0}`);
  console.log(`  Artifacts: ${state.artifacts?.length || 0}`);
  console.log(`  Memory entries: ${state.memory?.length || 0}`);
  console.log(`  Events: ${state.events?.length || 0}`);
  console.log(`  Connections: ${state.connections?.length || 0}`);
  
  console.log('\nSerialization Sizes:');
  console.log(`  JSON (compact): ${formatBytes(Buffer.byteLength(stateJson, 'utf8'))}`);
  console.log(`  JSON (pretty):  ${formatBytes(Buffer.byteLength(stateJsonPretty, 'utf8'))}`);
  console.log(`  Pretty overhead: ${((Buffer.byteLength(stateJsonPretty, 'utf8') / Buffer.byteLength(stateJson, 'utf8')) - 1).toFixed(2)}x`);
  
  // Count nested objects
  function countObjects(obj, depth = 0, maxDepth = 10) {
    if (depth > maxDepth) return 0;
    let count = 1;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item && typeof item === 'object') {
          count += countObjects(item, depth + 1, maxDepth);
        }
      }
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (obj[key] && typeof obj[key] === 'object') {
          count += countObjects(obj[key], depth + 1, maxDepth);
        }
      }
    }
    return count;
  }
  
  const objectCount = countObjects(state);
  console.log(`\n  Total nested objects: ~${objectCount}`);
  
  return state;
}

// ============================================================================
// STRUCTURED CLONE PROFILING
// ============================================================================

function profileStructuredClone(state) {
  console.log('\n' + '='.repeat(70));
  console.log('STRUCTURED CLONE PROFILE');
  console.log('='.repeat(70));
  
  const results = [];
  
  // Test different clone scenarios
  const scenarios = [
    { name: 'Full state clone', fn: () => structuredClone(state) },
    { name: 'State snapshot (via JSON)', fn: () => JSON.parse(JSON.stringify(state)) },
    { name: 'Shallow copy', fn: () => ({ ...state }) },
    { name: 'Shallow copy + shallow arrays', fn: () => {
      const copy = { ...state };
      copy.missions = [...state.missions];
      copy.agents = [...state.agents];
      copy.conversations = [...state.conversations];
      copy.artifacts = [...state.artifacts];
      copy.memory = [...state.memory];
      copy.events = [...state.events];
      copy.connections = [...state.connections];
      copy.needsYou = [...state.needsYou];
      copy.approvals = [...state.approvals];
      copy.spaces = [...state.spaces];
      return copy;
    }},
  ];
  
  console.log('\nClone Operation Comparison (100 iterations each):\n');
  
  for (const scenario of scenarios) {
    const result = measure(scenario.name, scenario.fn, 100);
    results.push(result);
    console.log(`  ${result.name.padEnd(35)}`);
    console.log(`    Avg: ${result.avg.padStart(12)} | P95: ${result.p95.padStart(12)} | Ops/sec: ${result.opsPerSec.padStart(15)}`);
  }
  
  console.log('\n' + '-'.repeat(70));
  console.log('ANALYSIS:');
  const fullClone = results.find(r => r.name === 'Full state clone');
  const shallow = results.find(r => r.name === 'Shallow copy');
  const jsonClone = results.find(r => r.name === 'State snapshot (via JSON)');
  
  if (fullClone && shallow) {
    const ratio = fullClone.rawAvg / shallow.rawAvg;
    console.log(`  structuredClone is ${ratio.toFixed(1)}x slower than shallow copy`);
  }
  
  if (fullClone && jsonClone) {
    const ratio = fullClone.rawAvg / jsonClone.rawAvg;
    console.log(`  structuredClone is ${ratio.toFixed(1)}x ${fullClone.rawAvg > jsonClone.rawAvg ? 'slower' : 'faster'} than JSON parse/stringify`);
  }
  
  return results;
}

// ============================================================================
// PERSISTENCE PROFILING
// ============================================================================

async function profilePersistence(state) {
  console.log('\n' + '='.repeat(70));
  console.log('PERSISTENCE PROFILE');
  console.log('='.repeat(70));
  
  const { mkdir, writeFile, rename } = await import('node:fs/promises');
  
  const tmpDir = path.join(ROOT, 'tmp-profile');
  await mkdir(tmpDir, { recursive: true }).catch(() => {});
  
  const scenarios = [
    { 
      name: 'JSON.stringify (compact)',
      fn: () => JSON.stringify(state)
    },
    { 
      name: 'JSON.stringify (pretty, 2-space)',
      fn: () => JSON.stringify(state, null, 2)
    },
    { 
      name: 'Full persist (compact)',
      async fn() {
        const body = JSON.stringify(state);
        const target = path.join(tmpDir, 'test-compact.json');
        const tmp = `${target}.tmp`;
        await writeFile(tmp, body, 'utf8');
        await rename(tmp, target);
      }
    },
    { 
      name: 'Full persist (pretty)',
      async fn() {
        const body = `${JSON.stringify(state, null, 2)}\n`;
        const target = path.join(tmpDir, 'test-pretty.json');
        const tmp = `${target}.tmp`;
        await writeFile(tmp, body, 'utf8');
        await rename(tmp, target);
      }
    },
  ];
  
  console.log('\nSerialization & Persistence (10 iterations each):\n');
  
  for (const scenario of scenarios) {
    const times = [];
    
    // Warmup
    for (let i = 0; i < 3; i++) {
      try { await scenario.fn(); } catch {}
    }
    
    // Measure
    for (let i = 0; i < 10; i++) {
      const start = performance.now();
      try { await scenario.fn(); } catch {}
      const end = performance.now();
      times.push(end - start);
    }
    
    times.sort((a, b) => a - b);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const p95 = times[Math.floor(times.length * 0.95)];
    
    console.log(`  ${scenario.name.padEnd(35)}`);
    console.log(`    Avg: ${formatMs(avg).padStart(12)} | P95: ${formatMs(p95).padStart(12)}`);
  }
  
  // Calculate overhead
  const compactStr = measure('JSON.stringify (compact)', () => JSON.stringify(state), 10);
  const prettyStr = measure('JSON.stringify (pretty)', () => JSON.stringify(state, null, 2), 10);
  
  console.log('\n' + '-'.repeat(70));
  console.log('ANALYSIS:');
  const overhead = (prettyStr.rawAvg / compactStr.rawAvg - 1) * 100;
  console.log(`  Pretty-printing adds ~${overhead.toFixed(0)}% overhead to serialization`);
  console.log(`  Estimated time saved by removing pretty-print: ${formatMs(compactStr.rawAvg - prettyStr.rawAvg)} per persist`);
}

// ============================================================================
// MUTATION PATTERN PROFILING
// ============================================================================

function profileMutationPatterns(state) {
  console.log('\n' + '='.repeat(70));
  console.log('MUTATION PATTERN PROFILE');
  console.log('='.repeat(70));
  
  // Simulate the current pattern from server-store.mjs
  function currentMutatePattern() {
    const clone = (value) => structuredClone(value);
    
    // This is what happens in mutate()
    const next = clone(state);  // Clone 1
    // Simulate mutation
    next.missions[0].progress = 50;
    const result = next;
    const final = clone(result ?? next);  // Clone 2
    const snapshot = clone(final);  // Clone 3 (from snapshot())
    return snapshot;
  }
  
  // Optimized pattern with selective cloning
  function optimizedMutatePattern() {
    // Only clone the path being mutated
    const next = {
      ...state,
      missions: [
        ...state.missions.slice(0, 0),
        { ...state.missions[0], progress: 50 },
        ...state.missions.slice(1)
      ]
    };
    return next;
  }
  
  // Pattern with cached snapshot
  let snapshotCache = null;
  let snapshotDirty = true;
  
  function cachedSnapshot() {
    if (!snapshotDirty) return structuredClone(snapshotCache);
    snapshotCache = structuredClone(state);
    snapshotDirty = false;
    return structuredClone(snapshotCache);
  }
  
  function mutateWithCache() {
    // Mutation
    const next = {
      ...state,
      missions: state.missions.map((m, i) => 
        i === 0 ? { ...m, progress: 50 } : m
      )
    };
    snapshotDirty = true;
    return next;
  }
  
  const current = measure('Current pattern (3 clones)', currentMutatePattern, 100);
  const optimized = measure('Optimized (selective clone)', optimizedMutatePattern, 100);
  
  console.log('\nMutation Pattern Comparison (100 iterations):\n');
  console.log(`  ${current.name.padEnd(35)}`);
  console.log(`    Avg: ${current.avg.padStart(12)} | P95: ${current.p95.padStart(12)}`);
  console.log(`  ${optimized.name.padEnd(35)}`);
  console.log(`    Avg: ${optimized.avg.padStart(12)} | P95: ${optimized.p95.padStart(12)}`);
  
  console.log('\n' + '-'.repeat(70));
  console.log('ANALYSIS:');
  const speedup = current.rawAvg / optimized.rawAvg;
  console.log(`  Selective cloning is ${speedup.toFixed(1)}x faster`);
  console.log(`  Time saved per mutation: ${formatMs(current.rawAvg - optimized.rawAvg)}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║        AFTERGRAPH STUDIO - PERFORMANCE PROFILER                   ║');
  console.log('║        Identifying structuredClone and persistence bottlenecks    ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
  
  const state = profileState();
  profileStructuredClone(state);
  await profilePersistence(state);
  profileMutationPatterns(state);
  
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('='.repeat(70));
  console.log('\n🎯 QUICK WINS:');
  console.log('  1. Remove pretty-printing from persistence (save ~50-70% serialize time)');
  console.log('  2. Cache store snapshots (eliminate redundant clones)');
  console.log('  3. Implement selective/path-based cloning for mutations');
  console.log('\n📊 NEXT STEPS:');
  console.log('  - Run this profiler in your environment to get exact numbers');
  console.log('  - Profile with realistic state sizes (100+ missions, 1000+ artifacts)');
  console.log('  - Measure impact of multiple concurrent mutations');
  console.log('\n');
}

main().catch(console.error);
