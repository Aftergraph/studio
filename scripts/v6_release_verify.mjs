import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const GATES = [
  { name: 'Node Tests (Unit, Domain, Invariants)', cmd: 'node', args: ['--test', 'tests/*.test.mjs'] },
  { name: 'Workspace Verification (Syntax, Architecture, Contracts)', cmd: 'node', args: ['scripts/verify.mjs'] },
  { name: 'Platform Source Contracts (Expo, SwiftUI)', cmd: 'node', args: ['scripts/platform_verify.mjs'] },
  { name: 'Browser Smoke (V4 & V5 Desktop & Mobile)', cmd: 'python', args: ['scripts/browser_smoke.py'] },
  { name: 'Browser Smoke V5', cmd: 'python', args: ['scripts/browser_smoke_v5.py'] },
  { name: 'V6 Browser QA (Research, Capabilities, Mobile)', cmd: 'python', args: ['scripts/v6_browser_qa.py'] },
  { name: 'Fullstack Bridge Smoke (APIs, Server Persistence)', cmd: 'python', args: ['scripts/fullstack_bridge_smoke_v5.py'] },
  { name: 'Upstream Source Truth (Exact-Head, Boundaries)', cmd: 'node', args: ['scripts/verify-upstreams.mjs'] },
  { name: 'Polyrepo Bridge Smoke (Upstream Adapters, Hub)', cmd: 'python', args: ['scripts/polyrepo_bridge_smoke_v5.py'] },
  { name: 'Performance Smoke (DOM counts, interaction p95)', cmd: 'python', args: ['scripts/performance_smoke.py'] },
  { name: 'Cross-System E2E Journeys A–E', cmd: 'python', args: ['scripts/v6_e2e.py'] },
  { name: 'Secret & Credential Scan', cmd: 'node', args: ['scripts/v6-secret-scan.mjs'] },
  { name: 'V6.1 Live Federation & Engine Fault-Tolerance Exit Gate', cmd: 'node', args: ['--test', 'tests/v6-1-live-federation.test.mjs'] },
  { name: 'V6.2 Universal Search & Context Exit Gate', cmd: 'node', args: ['--test', 'tests/v6-2-universal-search-context.test.mjs'] },
  { name: 'V6.3 Capability Runtime Exit Gate', cmd: 'node', args: ['--test', 'tests/v6-3-capability-runtime.test.mjs'] },
  { name: 'V6.4 Research OS Exit Gate', cmd: 'node', args: ['--test', 'tests/v6-4-research-os.test.mjs'] },
  { name: 'V6.5 Venture OS Exit Gate', cmd: 'node', args: ['--test', 'tests/v6-5-venture-os.test.mjs'] },
  { name: 'V7.0 Intent Journey Exit Gate', cmd: 'node', args: ['--test', 'tests/v7-0-intent-journey.test.mjs'] },
  { name: 'V7.1 Adaptive Workspace Exit Gate', cmd: 'node', args: ['--test', 'tests/v7-1-adaptive-workspace.test.mjs'] },
  { name: 'V7.2 Agent Society Exit Gate', cmd: 'node', args: ['--test', 'tests/v7-2-agent-society.test.mjs'] },
  { name: 'V7.3 Temporal Intelligence Exit Gate', cmd: 'node', args: ['--test', 'tests/v7-3-temporal-intelligence.test.mjs'] },
  { name: 'V7.4 Outcome Economy Exit Gate', cmd: 'node', args: ['--test', 'tests/v7-4-outcome-economy.test.mjs'] },
  { name: 'V8.0 Institutional Intelligence Exit Gate', cmd: 'node', args: ['--test', 'tests/v8-0-institutional-intelligence.test.mjs'] },
  { name: 'V8.1-A Backend Contract Boundary Exit Gate', cmd: 'node', args: ['--test', 'tests/v81-backend-contract.test.mjs'] },
  { name: 'V8.1-A Destructive Action Guard Exit Gate', cmd: 'node', args: ['--test', 'tests/v81-destructive-action.test.mjs'] },
  { name: 'V8.1 Distributed Node Identity Exit Gate', cmd: 'node', args: ['--test', 'tests/v81-distributed-node-identity.test.mjs'] },
  { name: 'V8.1 Distributed Convergence Exit Gate', cmd: 'node', args: ['--test', 'tests/v81-distributed-convergence.test.mjs'] },
  { name: 'V8.1 Distributed Server Sync Exit Gate', cmd: 'node', args: ['--test', 'tests/v81-distributed-sync.test.mjs'] },
  { name: 'V8.1 Distributed Aftergraph Exit Gate', cmd: 'node', args: ['--test', 'tests/v81-distributed-offline-client.test.mjs'] },
  { name: 'V8.2 Brain Knowledge Lifecycle Exit Gate', cmd: 'node', args: ['--test', 'tests/v82-brain-knowledge.test.mjs'] },
  { name: 'V8.2 Brain Server Promotion Exit Gate', cmd: 'node', args: ['--test', 'tests/v82-brain-server.test.mjs'] },
  { name: 'V8.2 Brain Promotion UI Exit Gate', cmd: 'node', args: ['--test', 'tests/v82-brain-ui.test.mjs'] },
  { name: 'V8.3 Autonomy Bounds Exit Gate', cmd: 'node', args: ['--test', 'tests/v83-autonomy-bounds.test.mjs'] },
  { name: 'V8.3 Autonomy Server Exit Gate', cmd: 'node', args: ['--test', 'tests/v83-autonomy-server.test.mjs'] },
  { name: 'V8.3 Autonomy Halt and Kill UI Exit Gate', cmd: 'node', args: ['--test', 'tests/v83-autonomy-ui.test.mjs'] },
  { name: 'User Profile Server Exit Gate', cmd: 'node', args: ['--test', 'tests/user-routes.test.mjs'] },
  { name: 'P1-009 Shared Currency Formatter Exit Gate', cmd: 'node', args: ['--test', 'tests/economy-currency.test.mjs'] },
  { name: 'Axe-Core 4.10.3 Accessibility Gate (WCAG 2.2 AA)', cmd: 'python', args: ['scripts/a11y_smoke.py'] }
];

console.log('====================================================');
console.log('AFTERGRAPH V6 MONOLITHIC RELEASE VERIFICATION RUNNER');
console.log('====================================================\n');

let passed = 0;
let failed = 0;

for (const gate of GATES) {
  process.stdout.write(`RUNNING: ${gate.name}... `);
  const result = spawnSync(gate.cmd, gate.args, { cwd: root, encoding: 'utf8' });
  if (result.status === 0) {
    console.log('PASS');
    passed++;
  } else {
    console.log('FAIL');
    console.error(`--- STDOUT ---\n${result.stdout}`);
    console.error(`--- STDERR ---\n${result.stderr}`);
    failed++;
  }
}

console.log('\n====================================================');
console.log(`RELEASE VERIFICATION SUMMARY: ${passed}/${GATES.length} GATES PASSED`);
if (failed > 0) {
  console.log(`STATUS: FAILED (${failed} gates failed)`);
  process.exit(1);
} else {
  console.log('STATUS: 100% PASS - ALL V6 RELEASE CRITERIA SATISFIED');
}
console.log('====================================================');
