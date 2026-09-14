import { createAppServer } from '../server.mjs';
import { billingFixtureState } from '../src/billing/fixtures.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(root, '..');
const port = Number(process.env.LEDGER_QA_PORT || 8765);
const host = process.env.LEDGER_QA_HOST || '127.0.0.1';

// FIX: Set AFTERGRAPH_DEMO_FIXTURES so billingFixtureState() actually seeds the store.
// Without this env var, createAppServer ignores the fixtures option and serves empty state.
process.env.AFTERGRAPH_DEMO_FIXTURES = 'true';

const server = createAppServer({
  root: projectRoot,
  stateFile: path.join(projectRoot, '.runtime', 'ledger-qa-state.json'),
  runtimeIntervalMs: 60000,
  fixtures: true,
  requireAuth: false,
  releaseSha: 'ledger-visual-qa-local',
});

server.listen(port, host, () => {
  console.log(`LEDGER-QA-SERVER-READY http://${host}:${port}/billing/`);
  console.log(`Fixtures loaded: billingFixtureState with ${billingFixtureState().customers.length} customers`);
});

process.once('SIGTERM', () => server.close());
process.once('SIGINT', () => server.close());
