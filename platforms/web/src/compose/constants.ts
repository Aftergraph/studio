// Compose Application Constants
export const STORAGE_KEY = 'aftergraph.compose.conversations.v1';
export const MAX_HISTORY_ITEMS = 40;
export const MAX_INPUT_LENGTH = 10000;
export const DEBOUNCE_MS = 300;
export const PROGRESS_ANIMATION_DURATION = 1300;
export const ARTIFACT_MAX_HEIGHT = 270;
export const TOAST_DURATION = 2000;
export const SCROLL_DEBOUNCE_MS = 100;

// Z-index scale
export const Z_INDEX = {
  dropdown: 100,
  sticky: 200,
  fixed: 300,
  modalBackdrop: 400,
  modal: 500,
  popover: 600,
  toast: 700,
  loading: 1000,
} as const;

// Animation durations
export const ANIMATION = {
  fast: '140ms',
  medium: '220ms',
  slow: '300ms',
} as const;

// Breakpoints
export const BREAKPOINTS = {
  mobile: '720px',
  tablet: '1100px',
  desktop: '1200px',
} as const;

// API Configuration
export const API = {
  compileEndpoint: '/api/v1/intent/compile',
  timeout: 30000, // 30 seconds
  retryDelay: 5000, // 5 seconds for auto-retry
  maxRetries: 3,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  emptyInput: 'Please enter some text to compose',
  inputTooLong: (max: number) => `Input too long (max ${max} characters)`,
  copyFailed: 'Failed to copy to clipboard',
  shareFailed: 'Failed to share',
  networkError: 'Network error - please check your connection',
  timeoutError: 'Request timed out - please try again',
  rateLimitError: 'Rate limit exceeded - please wait and try again',
  unknownError: 'Something went wrong - please try again',
  apiError: (status: number) => `API Error: ${status}`,
  validationError: 'Invalid response format from server',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  copied: 'Copied to clipboard!',
  shared: 'Shared successfully!',
  saved: 'Saved to history',
  deleted: 'Deleted successfully',
} as const;

// Target configurations
export const TARGETS = [
  { value: 'auto' as const, label: 'Auto' },
  { value: 'friday.chatgpt' as const, label: 'Friday / ChatGPT' },
  { value: 'anthropic.claude-code' as const, label: 'Claude Code' },
  { value: 'openai.codex' as const, label: 'Codex' },
  { value: 'aftergraph.hermes' as const, label: 'Hermes' },
  { value: 'generic' as const, label: 'Generic' },
] as const;

// Refinement options
export const REFINEMENTS = [
  'Clearer',
  'More detailed',
  'Shorter',
  'More autonomous',
  'Safer',
  'Execution-ready',
] as const;

// Status types
export type CompileStatus = 
  | 'idle'
  | 'working'
  | 'aborting'
  | 'aborted'
  | 'error'
  | 'queueing';

// Toast types
export type ToastType = 'success' | 'error' | 'info' | 'warning';

// Rate limit status
export type RateLimitStatus = {
  remaining: number;
  resetAt: number;
  limited: boolean;
};
