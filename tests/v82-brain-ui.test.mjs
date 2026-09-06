// V82-brain-03: memory lifecycle UI — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';
import { AGMemoryItem } from '../packages/ui/system/event-row.mjs';

test('Memory UI: ephemeral entry shows promote action with description', () => {
  const html = AGMemoryItem({ id: 'mem9', label: 'Style note', scope: 'project', source: 'runtime', status: 'ephemeral', confidence: 0.9 });
  assert.ok(html.includes('data-action="promote-memory"'), 'ephemeral must offer promotion');
  assert.ok(html.includes('ephemeral'), 'status text must name ephemeral');
  assert.ok(html.includes('aria-describedby'), 'promotion must describe impact');
  assert.ok(!html.includes('data-state="loading"') || html.includes('Promote'), 'not loading by default');
});

test('Memory UI: pending promotion disables actions', () => {
  const html = AGMemoryItem({ id: 'mem9', label: 'Style note', scope: 'project', source: 'runtime', status: 'ephemeral', confidence: 0.9, pendingAction: 'promote-memory' });
  assert.ok(html.includes('disabled'), 'actions disabled while pending');
  assert.ok(!html.includes('data-action="promote-memory"'), 'no clickable promote while pending');
});

test('Memory UI: authoritative entry offers no promotion', () => {
  const html = AGMemoryItem({ id: 'mem1', label: 'Principle', scope: 'workspace', source: 'governance', status: 'authoritative', confidence: 1 });
  assert.ok(!html.includes('promote-memory'), 'authoritative must not offer promotion');
  assert.ok(html.includes('authoritative'), 'status text must name authoritative');
});

test('Memory UI: legacy promoted flag still renders', () => {
  const html = AGMemoryItem({ id: 'mem1', label: 'Principle', scope: 'workspace', source: 'governance', promoted: true });
  assert.ok(html.includes('promoted') || html.includes('authoritative'), 'legacy promoted renders as trusted');
});
