import { describe, expect, it } from 'vitest';
import { mapCompileResponse } from '../../src/compose/presentation';
import type { CompileResponse } from '../../src/compose/types';

const sample: CompileResponse = {
  ir: { schema: 'aftergraph/intent-ir/v0.1', source: { text: 'Make this clearer', surface: 'compose-web' }, goal: { statement: 'Create a clear implementation instruction', successCriteria: ['Preserve constraints'] }, ambiguities: ['Target runtime is not explicit'] },
  target: { target: 'openai.codex', confidence: 0.91, reasonCodes: ['coding-task'], alternatives: [] },
  artifact: { target: 'openai.codex', mediaType: 'text/markdown', content: '# Goal\nCreate the feature.\n\n## Completion\n- Verify tests', semanticMap: { goal: ['Create the feature.'], completion: ['Verify tests'] } },
  findings: [{ code: 'ambiguity', detail: 'Target runtime is not explicit' }],
};

describe('mapCompileResponse', () => {
  it('creates an instruction artifact without inventing authority', () => {
    const result = mapCompileResponse(sample, 1);
    expect(result.kind).toBe('instruction');
    expect(result.target).toBe('openai.codex');
    expect(result.version).toBe(1);
    expect(result.content).toContain('Create the feature');
    expect(result.ambiguities).toEqual(['Target runtime is not explicit']);
  });

  it('stamps a createdAt timestamp', () => {
    const before = Date.now();
    const result = mapCompileResponse(sample, 1);
    const after = Date.now();
    expect(result.createdAt).toBeGreaterThanOrEqual(before);
    expect(result.createdAt).toBeLessThanOrEqual(after);
  });

  it('generates a unique id per call', () => {
    const a = mapCompileResponse(sample, 1);
    const b = mapCompileResponse(sample, 2);
    expect(a.id).not.toBe(b.id);
  });

  it('derives the title from the goal statement', () => {
    const result = mapCompileResponse(sample, 1);
    expect(result.title).toBe('Create a clear implementation instruction');
  });

  it('truncates long goal statements in the title', () => {
    const longGoal = { ...sample, ir: { ...sample.ir, goal: { ...sample.ir.goal, statement: 'A'.repeat(100) } } };
    const result = mapCompileResponse(longGoal, 1);
    expect(result.title.length).toBeLessThanOrEqual(72);
    expect(result.title.endsWith('…')).toBe(true);
  });
});

describe('live server contract', () => {
  const liveResponse = {
    ir: {
      schema: 'aftergraph/intent-ir/v0.1',
      source: { text: 'review the relay PR but do not merge without explicit approval', surface: 'compose-mobile' },
      goal: {
        statement: 'review the relay PR but do not merge without explicit app...',
        successCriteria: ['Output matches the stated objective', 'No write/execute authority assumed'],
      },
      artifact: { kind: 'task', persistence: 'ephemeral' },
      scope: { includes: [], excludes: [] },
      constraints: ['Do not exceed granted authority'],
      authority: { read: ['context'], write: [], execute: [], network: [], requiresApproval: [] },
      capabilities: { required: [], optional: [] },
      effects: [],
      verification: { required: false, obligations: [], completionRule: 'model-output' },
      output: { format: 'text', contract: [] },
      targetHints: [],
      ambiguities: [],
    },
    target: { target: 'generic', confidence: 0.5, reasonCodes: [], alternatives: [] },
    artifact: {
      target: 'generic',
      mediaType: 'text/plain',
      content: 'Objective\nreview the relay PR but do not merge without explicit app...\n\nContext / Scope\nNone specified\n\nConstraints\n- Do not exceed granted authority\n\nAuthority\nRead: context\n\nExpected Output\n- text\n\nCompletion / Verification\nUse the stated completion rule.',
      semanticMap: { goal: ['goal'], constraints: ['constraints'], authority: ['authority'], verification: ['verification'] },
    },
    findings: [],
  };

  it('parseCompileResponse accepts a real live server response', async () => {
    const { parseCompileResponse } = await import('../../src/compose/api');
    const parsed = parseCompileResponse(liveResponse);
    expect(parsed.ir.schema).toBe('aftergraph/intent-ir/v0.1');
    expect(parsed.artifact.mediaType).toBe('text/plain');
    expect(parsed.ir.goal.successCriteria).toHaveLength(2);
  });

  it('mapCompileResponse maps a live response with text/plain mediaType', () => {
    const result = mapCompileResponse(liveResponse as CompileResponse, 3);
    expect(result.kind).toBe('instruction');
    expect(result.target).toBe('generic');
    expect(result.version).toBe(3);
    expect(result.content).toContain('Do not exceed granted authority');
    expect(result.confidence).toBe(0.5);
    expect(result.ambiguities).toEqual([]);
  });
});
