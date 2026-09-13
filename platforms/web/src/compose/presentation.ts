import type { CompileResponse, InstructionArtifactModel } from './types';

function titleFromGoal(goal: string) {
  const trimmed = goal.trim();
  if (!trimmed) return 'Instruction';
  return trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed;
}

export function mapCompileResponse(
  response: CompileResponse,
  version: number,
): InstructionArtifactModel {
  return {
    kind: 'instruction',
    id: `${Date.now()}-${version}`,
    version,
    target: response.artifact.target || response.target.target,
    title: titleFromGoal(response.ir.goal.statement),
    content: response.artifact.content,
    goal: response.ir.goal.statement,
    successCriteria: response.ir.goal.successCriteria,
    ambiguities: response.ir.ambiguities,
    confidence: response.target.confidence,
    semanticMap: response.artifact.semanticMap,
  };
}
