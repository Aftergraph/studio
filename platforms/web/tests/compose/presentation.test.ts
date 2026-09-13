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
