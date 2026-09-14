import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('P0 Security Fixes Regression Tests', () => {
  test('Fix 1: auth header uses proper template literal with Bearer prefix', () => {
    const content = readFileSync(join(root, 'src/billing/browser-client.mjs'), 'utf8');
    // Must contain backtick-Bearer template literal, not broken *** syntax
    assert.ok(content.includes('`Bearer ${currentToken}`'), 'auth header must use `Bearer ${currentToken}` template literal');
    assert.ok(!content.includes('*** ${currentToken}'), 'broken *** syntax must be removed');
  });

  test('Fix 2: scheduler has concurrency guard to prevent duplicate drafts', () => {
    const content = readFileSync(join(root, 'server/billing-server.mjs'), 'utf8');
    assert.ok(content.includes('let schedulerRunning = false'), 'schedulerRunning flag must exist');
    assert.ok(content.includes('if (schedulerRunning) return'), 'concurrency guard must skip if running');
    assert.ok(content.includes('schedulerRunning = true'), 'must set running flag before tick');
    assert.ok(content.includes('schedulerRunning = false'), 'must clear running flag in finally');
  });

  test('Fix 3: withTimeout clears timer on abort to prevent leaks', () => {
    const content = readFileSync(join(root, 'src/billing/browser-client.mjs'), 'utf8');
    // The withTimeout helper must clear the timer when signal aborts
    assert.ok(content.includes('clearTimeout(timer)'), 'withTimeout must call clearTimeout');
    assert.ok(content.includes("{ once: true }"), 'abort listener should be one-shot to prevent leaks');
  });

  test('Fix 4: audit log has time-based pruning and bounded memory', () => {
    const content = readFileSync(join(root, 'server/billing-server.mjs'), 'utf8');
    assert.ok(content.includes('Time-based pruning'), 'must have time-based pruning comment');
    assert.ok(content.includes('90 * 24 * 60 * 60 * 1000'), 'must prune entries older than 90 days');
    assert.ok(content.includes('.filter((e) => e.timestamp >= cutoff)'), 'must filter by timestamp cutoff');
    assert.ok(content.includes('Bounded memory'), 'must have bounded memory comment');
    assert.ok(content.includes('.slice(-1000)'), 'must cap at 1000 entries');
  });

  test('Fix 5: recurring scheduler records failures in auditLog', () => {
    const content = readFileSync(join(root, 'src/billing/recurring.mjs'), 'utf8');
    assert.ok(content.includes('billing.recurring.tick_failed'), 'must record tick_failed event type');
    assert.ok(content.includes('next.auditLog.push'), 'must push failure to auditLog');
    assert.ok(content.includes('recurringId: recurring.id'), 'failure entry must include recurringId');
    assert.ok(content.includes('error: err?.message'), 'failure entry must include error message');
  });
});
