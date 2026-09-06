// V82-brain-01: knowledge lifecycle (provenance, retention, confidence, promotion) — RED first.
import test from 'node:test';
import assert from 'node:assert/strict';

let createKnowledgeEntry, promoteKnowledge, isAuthoritative, isExpired;
try {
  ({
    createKnowledgeEntry, promoteKnowledge, isAuthoritative, isExpired,
  } = await import('../src/brain/knowledge.mjs'));
} catch {}

test('Knowledge: entry starts ephemeral with provenance', () => {
  assert.ok(createKnowledgeEntry, 'createKnowledgeEntry must exist');
  const entry = createKnowledgeEntry({
    scope: 'project', label: 'Q4 style', value: 'Concise narrative.', source: 'user preference',
  });
  assert.ok(entry.id, 'entry must have id');
  assert.equal(entry.status, 'ephemeral');
  assert.ok(entry.provenance && typeof entry.provenance === 'object', 'provenance required');
  assert.equal(entry.provenance.source, 'user preference');
  assert.ok(entry.provenance.createdAt, 'provenance.createdAt required');
  assert.deepEqual(entry.provenance.promotions, [], 'no promotions at birth');
  assert.equal(isAuthoritative(entry), false, 'ephemeral is never authoritative');
});

test('Knowledge: confidence defaults and clamps to 0..1', () => {
  const def = createKnowledgeEntry({ scope: 'session', label: 'x', value: 'y', source: 'runtime' });
  assert.equal(def.confidence, 0, 'default confidence is 0');
  const high = createKnowledgeEntry({ scope: 'session', label: 'x', value: 'y', source: 'runtime', confidence: 0.8 });
  assert.equal(high.confidence, 0.8);
  assert.throws(() => createKnowledgeEntry({ scope: 's', label: 'x', value: 'y', source: 'r', confidence: 1.5 }), 'confidence > 1 rejected');
  assert.throws(() => createKnowledgeEntry({ scope: 's', label: 'x', value: 'y', source: 'r', confidence: -0.1 }), 'confidence < 0 rejected');
});

test('Knowledge: entry is frozen (immutable)', () => {
  const entry = createKnowledgeEntry({ scope: 's', label: 'x', value: 'y', source: 'r' });
  assert.throws(() => { entry.status = 'authoritative'; }, 'entry must be immutable');
});

test('Knowledge: promotion requires human approver and evidence', () => {
  assert.ok(promoteKnowledge, 'promoteKnowledge must exist');
  const entry = createKnowledgeEntry({ scope: 'project', label: 'x', value: 'y', source: 'runtime', confidence: 0.9 });
  assert.throws(() => promoteKnowledge(entry, { by: 'agent:worker', evidence: 'ev1' }), 'agent cannot promote');
  assert.throws(() => promoteKnowledge(entry, { by: 'demo-user' }), 'promotion without evidence rejected');
  const promoted = promoteKnowledge(entry, { by: 'demo-user', evidence: 'ev1' });
  assert.equal(promoted.status, 'authoritative');
  assert.equal(isAuthoritative(promoted), true);
  assert.equal(promoted.provenance.promotions.length, 1);
  assert.equal(promoted.provenance.promotions[0].by, 'demo-user');
  assert.equal(entry.status, 'ephemeral', 'original untouched (immutable)');
});

test('Knowledge: low-confidence entry cannot be promoted without explicit override', () => {
  const entry = createKnowledgeEntry({ scope: 'project', label: 'x', value: 'y', source: 'runtime', confidence: 0.2 });
  assert.throws(() => promoteKnowledge(entry, { by: 'demo-user', evidence: 'ev1' }), 'low confidence needs override');
  const forced = promoteKnowledge(entry, { by: 'demo-user', evidence: 'ev1', override: true });
  assert.equal(isAuthoritative(forced), true);
  assert.equal(forced.provenance.promotions[0].override, true);
});

test('Knowledge: retention expiry is explicit', () => {
  assert.ok(isExpired, 'isExpired must exist');
  const eternal = createKnowledgeEntry({ scope: 'workspace', label: 'x', value: 'y', source: 'governance' });
  assert.equal(isExpired(eternal), false, 'no retention = never expires');
  const short = createKnowledgeEntry({
    scope: 'session', label: 'x', value: 'y', source: 'runtime', retentionMs: 1000,
  });
  assert.equal(isExpired(short, new Date(Date.now() + 2000).toISOString()), true, 'expired after retention');
  assert.equal(isExpired(short, new Date().toISOString()), false, 'not expired within retention');
  assert.equal(isAuthoritative(short), false, 'ephemeral stays non-authoritative regardless of expiry');
});

test('Knowledge: expired authoritative entry loses authority', () => {
  const entry = createKnowledgeEntry({
    scope: 'session', label: 'x', value: 'y', source: 'runtime', confidence: 0.9, retentionMs: 1000,
  });
  const promoted = promoteKnowledge(entry, { by: 'demo-user', evidence: 'ev1' });
  assert.equal(isAuthoritative(promoted, new Date().toISOString()), true);
  assert.equal(isAuthoritative(promoted, new Date(Date.now() + 2000).toISOString()), false, 'expired = not authoritative');
});
