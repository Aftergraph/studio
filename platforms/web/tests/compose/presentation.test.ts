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
});