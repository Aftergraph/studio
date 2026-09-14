export type ComposeTarget = 'auto' | 'friday.chatgpt' | 'anthropic.claude-code' | 'openai.codex' | 'aftergraph.hermes' | 'generic';

export type CompileResponse = {
  ir: {
    schema: string;
    source: { text: string; surface: string };
    goal: { statement: string; successCriteria: string[] };
    ambiguities: string[];
  };
  target: { target: string; confidence: number; reasonCodes: string[]; alternatives: string[] };
  artifact: { target: string; mediaType: string; content: string; semanticMap: Record<string,string[]> };
  findings: Array<{ code: string; detail?: string }>;
};
