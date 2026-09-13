import type { CompileResponse, ComposeTarget } from './types';

export class ComposeProtocolError extends Error {
  constructor(message = 'Invalid Compose response') {
    super(message);
    this.name = 'ComposeProtocolError';
  }
}

export class ComposeHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Compose request failed (${status})`);
    this.name = 'ComposeHttpError';
    this.status = status;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function parseCompileResponse(value: unknown): CompileResponse {
  if (!value || typeof value !== 'object') throw new ComposeProtocolError();
  const root = value as Record<string, unknown>;
  const ir = root.ir as Record<string, unknown> | undefined;
  const target = root.target as Record<string, unknown> | undefined;
  const artifact = root.artifact as Record<string, unknown> | undefined;
  if (!ir || !target || !artifact || !Array.isArray(root.findings)) throw new ComposeProtocolError();

  const source = ir.source as Record<string, unknown> | undefined;
  const goal = ir.goal as Record<string, unknown> | undefined;
  if (typeof ir.schema !== 'string' || !source || typeof source.text !== 'string') throw new ComposeProtocolError();
  if (typeof source.surface !== 'string' || !goal || typeof goal.statement !== 'string') throw new ComposeProtocolError();
  if (!isStringArray(goal.successCriteria) || !isStringArray(ir.ambiguities)) throw new ComposeProtocolError();
  if (typeof target.target !== 'string' || typeof target.confidence !== 'number') throw new ComposeProtocolError();
  if (!isStringArray(target.reasonCodes) || !isStringArray(target.alternatives)) throw new ComposeProtocolError();
  if (typeof artifact.target !== 'string' || typeof artifact.mediaType !== 'string') throw new ComposeProtocolError();
  if (typeof artifact.content !== 'string' || !artifact.semanticMap || typeof artifact.semanticMap !== 'object') throw new ComposeProtocolError();
  return value as CompileResponse;
}

export async function compileIntent(
  source: string,
  target: ComposeTarget = 'auto',
  refinement?: string,
  signal: AbortSignal | null = null,
): Promise<CompileResponse> {
  const response = await fetch('/api/v1/intent/compile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ source, target, refinement: refinement || null }),
    signal,
  });
  if (!response.ok) throw new ComposeHttpError(response.status);
  return parseCompileResponse(await response.json());
}
