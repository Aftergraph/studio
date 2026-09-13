#!/usr/bin/env node
/**
 * Performance Monitoring Dashboard
 * 
 * Real-time monitoring of performance metrics for Aftergraph Studio.
 * Run this alongside your application to track performance.
 * 
 * Usage:
 *   node scripts/performance-monitor.mjs [--interval 5000] [--port 3001]
 */

import { performance } from 'node:perf_hooks';
import http from 'node:http';
import { createInitialState } from '../src/state.mjs';
import { WorkspaceStateStore } from '../src/server-store.mjs';
import { setIn } from '../src/state-update.mjs';

const clone = value => structuredClone(value);

// Configuration
const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_PORT = 3001;

// Metrics storage
const metrics = {
  cloneOperations: [],
  persistOperations: [],
  stateSizes: [],
  memoryUsage: [],
  lastReset: Date.now(),
};

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Helper to format time
function formatMs(ms) {
  if (ms < 1) return `${(ms * 1000).toFixed(2)} μs`;
  if (ms < 1000) return `${ms.toFixed(2)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// Measure a clone operation
function measureClone(state) {
  const start = performance.now();
  clone(state);
  const end = performance.now();
  return (end - start) * 1000; // μs
}

// Measure persistence
async function measurePersist(store) {
  const start = performance.now();
  await store.persist();
  const end = performance.now();
  return (end - start) * 1000; // μs
}

// Collect metrics
async function collectMetrics() {
  const state = createInitialState({ fixtures: true });
  const store = new WorkspaceStateStore({ stateFile: null, initialState: state });
  await store.init();
  
  // Clone metrics
  const cloneTime = measureClone(state);
  metrics.cloneOperations.push({
    time: Date.now(),
    duration: cloneTime,
  });
  
  // Persist metrics
  const persistTime = await measurePersist(store);
  metrics.persistOperations.push({
    time: Date.now(),
    duration: persistTime,
  });
  
  // State size metrics
  const compactSize = Buffer.byteLength(JSON.stringify(state), 'utf8');
  const prettySize = Buffer.byteLength(JSON.stringify(state, null, 2), 'utf8');
  metrics.stateSizes.push({
    time: Date.now(),
    compact: compactSize,
    pretty: prettySize,
  });
  
  // Memory metrics
  const memUsage = process.memoryUsage();
  metrics.memoryUsage.push({
    time: Date.now(),
    heapUsed: memUsage.heapUsed,
    heapTotal: memUsage.heapTotal,
    external: memUsage.external,
  });
  
  // Cleanup old metrics (keep last 100)
  const cutoff = Date.now() - 60000; // 1 minute
  metrics.cloneOperations = metrics.cloneOperations.filter(m => m.time > cutoff);
  metrics.persistOperations = metrics.persistOperations.filter(m => m.time > cutoff);
  metrics.stateSizes = metrics.stateSizes.filter(m => m.time > cutoff);
  metrics.memoryUsage = metrics.memoryUsage.filter(m => m.time > cutoff);
}

// Calculate statistics
function calculateStats(data) {
  if (data.length === 0) return { count: 0 };
  
  const values = data.map(d => d.duration || d.compact || d.heapUsed);
  values.sort((a, b) => a - b);
  
  const sum = values.reduce((a, b) => a + b, 0);
  const avg = sum / values.length;
  const p50 = values[Math.floor(values.length * 0.5)];
  const p95 = values[Math.floor(values.length * 0.95)];
  const p99 = values[Math.floor(values.length * 0.99)];
  
  return {
    count: values.length,
    avg,
    p50,
    p95,
    p99,
    min: values[0],
    max: values[values.length - 1],
  };
}

// Generate HTML dashboard
function generateDashboard() {
  const cloneStats = calculateStats(metrics.cloneOperations);
  const persistStats = calculateStats(metrics.persistOperations);
  
  const latestSize = metrics.stateSizes[metrics.stateSizes.length - 1];
  const latestMem = metrics.memoryUsage[metrics.memoryUsage.length - 1];
  
  const uptime = ((Date.now() - metrics.lastReset) / 1000).toFixed(1);
  
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Aftergraph Studio - Performance Monitor</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 20px;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      color: #00ff88;
      font-size: 24px;
      margin-bottom: 20px;
      border-bottom: 1px solid #333;
      padding-bottom: 10px;
    }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .card {
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 20px;
    }
    .card h2 {
      color: #00ff88;
      font-size: 16px;
      margin-bottom: 15px;
    }
    .stat {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #222;
    }
    .stat:last-child { border-bottom: none; }
    .label { color: #888; }
    .value { color: #fff; font-family: monospace; }
    .value.good { color: #00ff88; }
    .value.warn { color: #ffcc00; }
    .value.bad { color: #ff4444; }
    .uptime {
      text-align: right;
      color: #666;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .refresh { text-align: right; color: #444; font-size: 12px; }
    .metric-name { color: #00ff88; font-size: 14px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #fff; }
    .metric-unit { color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>⚡ Aftergraph Studio - Performance Monitor</h1>
    <div class="uptime">Uptime: ${uptime} seconds | Last update: ${new Date().toLocaleTimeString()}</div>
    
    <div class="grid">
      <div class="card">
        <h2>📊 Clone Operations</h2>
        <div class="stat"><span class="label">Count (1 min):</span><span class="value">${cloneStats.count}</span></div>
        <div class="stat"><span class="label">Avg:</span><span class="value">${formatMs(cloneStats.avg / 1000)}</span></div>
        <div class="stat"><span class="label">P50:</span><span class="value">${formatMs(cloneStats.p50 / 1000)}</span></div>
        <div class="stat"><span class="label">P95:</span><span class="value">${formatMs(cloneStats.p95 / 1000)}</span></div>
        <div class="stat"><span class="label">P99:</span><span class="value">${formatMs(cloneStats.p99 / 1000)}</span></div>
      </div>
      
      <div class="card">
        <h2>💾 Persistence</h2>
        <div class="stat"><span class="label">Count (1 min):</span><span class="value">${persistStats.count}</span></div>
        <div class="stat"><span class="label">Avg:</span><span class="value">${formatMs(persistStats.avg / 1000)}</span></div>
        <div class="stat"><span class="label">P50:</span><span class="value">${formatMs(persistStats.p50 / 1000)}</span></div>
        <div class="stat"><span class="label">P95:</span><span class="value">${formatMs(persistStats.p95 / 1000)}</span></div>
        <div class="stat"><span class="label">P99:</span><span class="value">${formatMs(persistStats.p99 / 1000)}</span></div>
      </div>
      
      <div class="card">
        <h2>📏 State Size</h2>
        ${latestSize ? `
        <div class="stat"><span class="label">Compact:</span><span class="value">${formatBytes(latestSize.compact)}</span></div>
        <div class="stat"><span class="label">Pretty:</span><span class="value">${formatBytes(latestSize.pretty)}</span></div>
        <div class="stat"><span class="label">Overhead:</span><span class="value">${((latestSize.pretty / latestSize.compact - 1) * 100).toFixed(1)}%</span></div>
        ` : '<div class="stat"><span class="label">No data</span><span class="value">-</span></div>'}
      </div>
      
      <div class="card">
        <h2>💻 Memory Usage</h2>
        ${latestMem ? `
        <div class="stat"><span class="label">Heap Used:</span><span class="value">${formatBytes(latestMem.heapUsed)}</span></div>
        <div class="stat"><span class="label">Heap Total:</span><span class="value">${formatBytes(latestMem.heapTotal)}</span></div>
        <div class="stat"><span class="label">External:</span><span class="value">${formatBytes(latestMem.external)}</span></div>
        <div class="stat"><span class="label">Usage:</span><span class="value">${((latestMem.heapUsed / latestMem.heapTotal) * 100).toFixed(1)}%</span></div>
        ` : '<div class="stat"><span class="label">No data</span><span class="value">-</span></div>'}
      </div>
    </div>
    
    <div class="refresh">Auto-refresh every 5 seconds | <a href="" style="color: #00ff88;">Refresh now</a></div>
  </div>
</body>
</html>`;
  
  return html;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    interval: DEFAULT_INTERVAL_MS,
    port: DEFAULT_PORT,
  };
  
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--interval':
        config.interval = parseInt(args[++i], 10) || DEFAULT_INTERVAL_MS;
        break;
      case '--port':
        config.port = parseInt(args[++i], 10) || DEFAULT_PORT;
        break;
      case '--help':
      case '-h':
        console.log('Usage: node scripts/performance-monitor.mjs [options]');
        console.log('');
        console.log('Options:');
        console.log('  --interval <ms>   Collection interval in milliseconds (default: 5000)');
        console.log('  --port <port>     HTTP server port (default: 3001)');
        console.log('  --help, -h        Show this help');
        console.log('');
        console.log('Open http://localhost:<port> in your browser to view the dashboard.');
        process.exit(0);
    }
  }
  
  return config;
}

// Main
async function main() {
  const { interval, port } = parseArgs();
  
  console.log('🚀 Aftergraph Studio - Performance Monitor');
  console.log(`   Interval: ${interval}ms`);
  console.log(`   Dashboard: http://localhost:${port}`);
  console.log('');
  console.log('Press Ctrl+C to stop\n');
  
  // Start HTTP server
  const server = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(generateDashboard());
    } else if (req.url === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(metrics, null, 2));
    } else if (req.url === '/reset') {
      metrics.cloneOperations = [];
      metrics.persistOperations = [];
      metrics.stateSizes = [];
      metrics.memoryUsage = [];
      metrics.lastReset = Date.now();
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('Metrics reset');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  
  server.listen(port, () => {
    console.log(`✅ Dashboard server running on port ${port}`);
  });
  
  // Start collecting metrics
  const collect = async () => {
    try {
      await collectMetrics();
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
    setTimeout(collect, interval);
  };
  
  // Initial collection
  await collect();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n👋 Shutting down performance monitor...');
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
    
    setTimeout(() => {
      console.log('⚠️  Server did not close gracefully');
      process.exit(1);
    }, 5000);
  });
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
