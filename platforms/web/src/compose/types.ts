export type ComposeTarget =
  | 'auto'
  | 'friday.chatgpt'
  | 'anthropic.claude-code'
  | 'openai.codex'
  | 'aftergraph.hermes'
  | 'generic';

export type CompileResponse = {
  ir: {
    schema: string;
    source: { text: string; surface: string };
    goal: { statement: string; successCriteria: string[] };
    ambiguities: string[];
  };
  target: { target: string; confidence: number; reasonCodes: string[]; alternatives: string[] };
  artifact: { target: string; mediaType: string; content: string; semanticMap: Record<string, string[]> };
  findings: Array<{ code: string; detail?: string }>;
};

export type InstructionArtifactModel = {
  kind: 'instruction';
  id: string;
  version: number;
  target: string;
  title: string;
  content: string;
  goal: string;
  successCriteria: string[];
  ambiguities: string[];
  confidence: number;
  semanticMap: Record<string, string[]>;
};

export type ConversationItem = {
  id: string;
  source: string;
  createdAt: number;
  activeVersion: number;
  artifacts: InstructionArtifactModel[];
  title?: string;
};

// Toast types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

export type ToastState = {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  dismissible?: boolean;
};

// Compile status types
export type CompileStatus = 
  | 'idle'
  | 'working'
  | 'aborting'
  | 'aborted'
  | 'error'
  | 'queueing';

// Rate limit status
export type RateLimitStatus = {
  remaining: number;
  resetAt: number;
  limited: boolean;
};
