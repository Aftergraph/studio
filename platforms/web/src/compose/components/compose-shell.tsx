'use client';

import { 
  FormEvent, 
  KeyboardEvent, 
  useCallback, 
  useEffect, 
  useMemo, 
  useRef, 
  useState 
} from 'react';
import { compileIntent, ComposeHttpError, ComposeProtocolError } from '../api';
import { mapCompileResponse } from '../presentation';
import { 
  generateId, 
  copyToClipboard, 
  shareContent, 
  downloadAsFile,
  debounce,
  isOnline,
  formatDate,
  scrollToBottom
} from '../utils';
import { 
  STORAGE_KEY, 
  MAX_HISTORY_ITEMS, 
  MAX_INPUT_LENGTH,
  DEBOUNCE_MS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TARGETS,
  REFINEMENTS
} from '../constants';
import type { ComposeTarget, ConversationItem, InstructionArtifactModel } from '../types';
import { useToast } from './Toast';
import { LoadingSpinner } from './LoadingSpinner';

// Extended conversation item with metadata
type ExtendedConversationItem = ConversationItem & {
  title?: string;
};

// Rate limit tracking
let lastRequestTime = 0;
let requestCount = 0;
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 30; // Max requests per window

function checkRateLimit(): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  
  // Reset window if expired
  if (now - lastRequestTime > RATE_LIMIT_WINDOW) {
    requestCount = 0;
    lastRequestTime = now;
  }
  
  const remaining = Math.max(0, RATE_LIMIT_MAX - requestCount);
  const resetAt = lastRequestTime + RATE_LIMIT_WINDOW;
  const allowed = requestCount < RATE_LIMIT_MAX;
  
  if (allowed) {
    requestCount++;
    lastRequestTime = now;
  }
  
  return { allowed, remaining, resetAt };
}

function getConversationTitle(item: ConversationItem): string {
  return item.artifacts.at(-1)?.title || item.source;
}

function getTargetLabel(target: string): string {
  return TARGETS.find((item) => item.value === target)?.label ?? target;
}

export function ComposeShell() {
  // State
  const [source, setSource] = useState('');
  const [target, setTarget] = useState<ComposeTarget>('auto');
  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [history, setHistory] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<InstructionArtifactModel | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'aborting' | 'aborted' | 'error' | 'queueing'>('idle');
  const [error, setError] = useState('');
  const [isOnlineState, setIsOnlineState] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  
  // Refs
  const streamRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toast = useToast();
  
  // Memoized values
  const active = useMemo(() => {
    if (!conversation) return null;
    return conversation.artifacts.find((item) => item.version === conversation.activeVersion) ?? null;
  }, [conversation]);
  
  const filteredHistory = useMemo(() => {
    if (!searchQuery) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(item => 
      item.source.toLowerCase().includes(query) ||
      item.artifacts.some(a => a.title.toLowerCase().includes(query))
    );
  }, [history, searchQuery]);
  
  const isInputTooLong = source.length > MAX_INPUT_LENGTH;
  const canSubmit = source.trim() && !isInputTooLong && status === 'idle' && isOnlineState;
  const rateLimit = checkRateLimit();
  const isRateLimited = !rateLimit.allowed;
  
  // Effects
  useEffect(() => {
    // Load history on mount
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setHistory(JSON.parse(saved) as ConversationItem[]);
      }
    } catch {
      // localStorage not available or corrupted
    }
    
    // Check online status
    setIsOnlineState(isOnline());
    
    const handleOnline = () => setIsOnlineState(true);
    const handleOffline = () => setIsOnlineState(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Debounced save to localStorage
  const saveHistory = useCallback(debounce(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, MAX_HISTORY_ITEMS)));
      } catch {
        // localStorage full or not available
      }
    }
  }, DEBOUNCE_MS), [history]);
  
  useEffect(() => {
    saveHistory();
  }, [history, saveHistory]);
  
  // Auto-select active artifact
  useEffect(() => {
    if (active) setSelected(active);
  }, [active]);
  
  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (status === 'working' || conversation) {
      scrollToBottom(streamRef.current, 'smooth');
    }
  }, [status, conversation]);
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        if (status === 'working') {
          e.preventDefault();
          cancelCompile();
        }
        if (selected) {
          e.preventDefault();
          setSelected(null);
        }
      }
      
      // Cmd/Ctrl + K to focus composer
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        composerRef.current?.focus();
      }
      
      // Cmd/Ctrl + Enter to submit
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
        e.preventDefault();
        handleSubmit();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, selected, canSubmit]);
  
  // Functions
  function persist(next: ConversationItem) {
    setConversation(next);
    setHistory((items) => [next, ...items.filter((item) => item.id !== next.id)]);
  }
  
  function cancelCompile() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('aborted');
      toast.info('Compile cancelled');
    }
  }
  
  async function runCompile(raw: string, refinement?: string) {
    const text = raw.trim();
    if (!text) {
      setError(ERROR_MESSAGES.emptyInput);
      setStatus('error');
      return;
    }
    
    if (text.length > MAX_INPUT_LENGTH) {
      setError(ERROR_MESSAGES.inputTooLong(MAX_INPUT_LENGTH));
      setStatus('error');
      return;
    }
    
    if (!isOnlineState) {
      setError(ERROR_MESSAGES.networkError);
      setStatus('error');
      return;
    }
    
    if (isRateLimited) {
      setError(ERROR_MESSAGES.rateLimitError);
      setStatus('error');
      return;
    }
    
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    setStatus('working');
    setError('');
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    try {
      const nextVersion = (conversation?.artifacts.length ?? 0) + 1;
      const result = await compileIntent(text, target, refinement, controller.signal);
      const artifact = mapCompileResponse(result, nextVersion);
      
      const next: ConversationItem = conversation
        ? { ...conversation, activeVersion: nextVersion, artifacts: [...conversation.artifacts, artifact] }
        : { id: generateId(), source: text, createdAt: Date.now(), activeVersion: 1, artifacts: [artifact] };
      
      persist(next);
      setSelected(artifact);
      setSource('');
      setStatus('idle');
      toast.success(SUCCESS_MESSAGES.saved);
      
    } catch (cause) {
      if ((cause as Error).name === 'AbortError') {
        // Request was cancelled
        if (controller.signal.aborted) {
          setStatus('aborted');
          return;
        }
      }
      
      const message = cause instanceof ComposeHttpError
        ? cause.status === 429
          ? ERROR_MESSAGES.rateLimitError
          : cause.status === 503
            ? ERROR_MESSAGES.timeoutError
            : ERROR_MESSAGES.apiError(cause.status)
        : cause instanceof ComposeProtocolError
          ? ERROR_MESSAGES.validationError
          : cause instanceof Error
            ? cause.message
            : ERROR_MESSAGES.unknownError;
      
      setError(message);
      setStatus('error');
      toast.error(message);
      
      // Auto-retry for 503 errors
      if (cause instanceof ComposeHttpError && cause.status === 503) {
        setTimeout(() => {
          if (status === 'error') {
            runCompile(text, refinement);
          }
        }, 5000);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }
  
  async function handleSubmit(event?: FormEvent) {
    if (event) event.preventDefault();
    await runCompile(source);
  }
  
  async function refine(label: string) {
    if (!conversation) return;
    await runCompile(conversation.source, label);
  }
  
  async function copyArtifact() {
    if (!selected) return;
    const success = await copyToClipboard(selected.content);
    if (success) {
      toast.success(SUCCESS_MESSAGES.copied);
    } else {
      toast.error(ERROR_MESSAGES.copyFailed);
    }
  }
  
  async function shareArtifact() {
    if (!selected) return;
    const success = await shareContent(selected.title, selected.content);
    if (success) {
      toast.success(SUCCESS_MESSAGES.shared);
    } else {
      // Fallback to copy
      await copyArtifact();
    }
  }
  
  function downloadArtifact() {
    if (!selected) return;
    const filename = `artifact-${selected.id}-v${selected.version}.md`;
    downloadAsFile(selected.content, filename, 'text/markdown');
    toast.success('Artifact downloaded');
  }
  
  function openArtifactInTab() {
    if (!selected) return;
    // This would open in a new tab - for now just copy
    copyArtifact();
    toast.info('Open in tab - feature coming soon');
  }
  
  function newChat() {
    // Cancel any ongoing request
    cancelCompile();
    setConversation(null);
    setSelected(null);
    setSource('');
    setStatus('idle');
    setError('');
    setSearchQuery('');
  }
  
  function openConversation(item: ConversationItem) {
    setConversation(item);
    setSelected(item.artifacts.find((artifact) => artifact.version === item.activeVersion) ?? item.artifacts.at(-1) ?? null);
    setSearchQuery('');
  }
  
  function deleteConversation(id: string) {
    setHistory((items) => items.filter((item) => item.id !== id));
    if (conversation?.id === id) {
      setConversation(null);
      setSelected(null);
    }
    toast.success(SUCCESS_MESSAGES.deleted);
  }
  
  function startEditConversation(id: string) {
    const conv = history.find((item) => item.id === id);
    if (conv) {
      setEditingConversationId(id);
      setEditTitle(getConversationTitle(conv));
    }
  }
  
  function saveEditConversation() {
    if (!editingConversationId) return;
    
    setHistory((items) => 
      items.map((item) => 
        item.id === editingConversationId 
          ? { ...item, title: editTitle } 
          : item
      )
    );
    
    // Update current conversation if editing
    if (conversation?.id === editingConversationId) {
      setConversation({ ...conversation, title: editTitle });
    }
    
    setEditingConversationId(null);
    setEditTitle('');
    toast.success('Conversation renamed');
  }
  
  function cancelEditConversation() {
    setEditingConversationId(null);
    setEditTitle('');
  }
  
  function setActiveVersion(version: number) {
    if (!conversation) return;
    setConversation({ ...conversation, activeVersion: version });
  }
  
  // Render
  return (
    <main className="compose-shell" aria-label="Compose workspace">
      {/* Toast Provider */}
      
      {/* Loading Overlay */}
      {status === 'working' && (
        <LoadingSpinner overlay text="Understanding your intention..." />
      )}
      
      {/* Offline Banner */}
      {!isOnlineState && (
        <div className="offline-banner" role="alert" aria-live="assertive">
          <span className="offline-indicator" />
          <span>Working offline - some features limited</span>
        </div>
      )}
      
      {/* Rate Limit Warning */}
      {isRateLimited && (
        <div className="rate-limit-banner" role="alert" aria-live="polite">
          <span className="rate-limit-indicator" />
          <span>Rate limited - please wait {Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s</span>
        </div>
      )}
      
      {/* Sidebar */}
      <aside className="compose-sidebar" aria-label="Compose history">
        <div className="brand-lockup">
          <span className="brand-mark">A</span>
          <div>
            <strong>Aftergraph</strong>
            <small>From thought to action.</small>
          </div>
        </div>
        
        <div className="sidebar-actions">
          <button className="new-chat" type="button" onClick={newChat} disabled={status === 'working'}>
            ➕ New chat
          </button>
          
          <div className="search-box">
            <input
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button 
                className="search-clear" 
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                type="button"
              >
                ×
              </button>
            )}
          </div>
        </div>
        
        <div className="side-label">History</div>
        <nav className="history-list" aria-label="Conversation history">
          {filteredHistory.length === 0 ? (
            <p className="empty-history">
              {searchQuery ? 'No matching conversations found' : 'Your conversations will appear here'}
            </p>
          ) : (
            filteredHistory.map((item) => (
              <div className="history-item" key={item.id}>
                {editingConversationId === item.id ? (
                  <div className="history-edit">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') saveEditConversation();
                        if (e.key === 'Escape') cancelEditConversation();
                      }}
                      autoFocus
                    />
                    <button 
                      className="edit-save" 
                      onClick={saveEditConversation}
                      aria-label="Save"
                      type="button"
                    >
                      ✓
                    </button>
                    <button 
                      className="edit-cancel" 
                      onClick={cancelEditConversation}
                      aria-label="Cancel"
                      type="button"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      className={conversation?.id === item.id ? 'history-row active' : 'history-row'}
                      onClick={() => openConversation(item)}
                      type="button"
                      disabled={status === 'working'}
                    >
                      <span>{getConversationTitle(item)}</span>
                      <small>v{item.activeVersion}</small>
                    </button>
                    <div className="history-item-actions">
                      <button 
                        className="history-action-btn" 
                        onClick={() => startEditConversation(item.id)}
                        aria-label="Rename conversation"
                        type="button"
                      >
                        ✏️
                      </button>
                      <button 
                        className="history-action-btn" 
                        onClick={() => deleteConversation(item.id)}
                        aria-label="Delete conversation"
                        type="button"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </nav>
        
        <div className="authority-note">
          <span className="status-dot" />
          Intelligence under your authority
        </div>
      </aside>
      
      {/* Main Conversation Pane */}
      <section className="conversation-pane">
        <header className="compose-topbar">
          <div>
            <p className="eyebrow">Aftergraph</p>
            <h1>Compose</h1>
          </div>
          <label className="target-control">
            Target
            <select 
              value={target} 
              onChange={(event) => setTarget(event.target.value as ComposeTarget)}
              disabled={status === 'working'}
              aria-label="Select AI target"
            >
              {TARGETS.map((item) => (
                <option value={item.value} key={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </header>
        
        <div 
          className="conversation-stream" 
          aria-live="polite"
          ref={streamRef}
        >
          {/* Welcome State */}
          {!conversation && status === 'idle' && (
            <div className="welcome">
              <span className="welcome-mark">A</span>
              <h2>Skriv som du tænker.</h2>
              <p>Compose gør rå tanker til klare instruktioner, klar til den rigtige AI eller agent.</p>
              {isRateLimited && (
                <p className="rate-limit-hint">
                  ⚠️ Rate limited - please wait {Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s
                </p>
              )}
            </div>
          )}
          
          {/* User Turn */}
          {conversation && (
            <div className="turn user-turn" role="region" aria-label="Your input">
              <span className="avatar" aria-hidden="true">JA</span>
              <div>
                <p>{conversation.source}</p>
                <small>Original tanke</small>
              </div>
            </div>
          )}
          
          {/* Working State */}
          {status === 'working' && (
            <div className="turn compose-turn working" role="status" aria-live="polite">
              <span className="ai-mark" aria-hidden="true">A</span>
              <div>
                <strong>Forstår din intention…</strong>
                <p>Finder mål, constraints og den rigtige struktur uden at udvide din authority.</p>
                <div className="progress-line">
                  <span />
                </div>
              </div>
            </div>
          )}
          
          {/* Aborted State */}
          {status === 'aborted' && (
            <div className="turn compose-turn aborted" role="status">
              <span className="ai-mark" aria-hidden="true">A</span>
              <div>
                <strong>Compile annulleret</strong>
                <p>Du kan prøve igen når du er klar.</p>
              </div>
            </div>
          )}
          
          {/* Error State */}
          {error && (
            <div className="error-card" role="alert" aria-live="assertive">
              <strong>Compile mislykkedes</strong>
              <p>{error}</p>
              <div className="error-actions">
                <button 
                  type="button" 
                  onClick={() => runCompile(conversation?.source || source)}
                  disabled={status === 'working'}
                >
                  Prøv igen
                </button>
                {status === 'working' && (
                  <button type="button" onClick={cancelCompile} className="btn-secondary">
                    Annuller
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Rate Limited State */}
          {isRateLimited && !error && (
            <div className="warning-card" role="status">
              <strong>⚠️ Rate Limited</strong>
              <p>Too many requests - please wait {Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s</p>
            </div>
          )}
          
          {/* Offline State */}
          {!isOnlineState && !error && (
            <div className="warning-card" role="status">
              <strong>⚠️ Offline</strong>
              <p>Please check your internet connection</p>
            </div>
          )}
          
          {/* Artifact Card */}
          {active && (
            <article 
              className="artifact-card" 
              onClick={() => setSelected(active)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelected(active);
                }
              }}
              aria-label={`Instruction artifact v${active.version}, click to view details`}
            >
              <div className="artifact-card-head">
                <span>✦ Instruction artifact</span>
                <span className="version-pill">v{active.version}</span>
              </div>
              <h2>{active.title}</h2>
              <p>{active.goal}</p>
              <div className="artifact-meta">
                <span>{getTargetLabel(active.target)}</span>
                <span>{Math.round(active.confidence * 100)}% confidence</span>
                <span>Ready</span>
              </div>
              <pre><code>{active.content}</code></pre>
              <div className="artifact-actions">
                <button 
                  type="button" 
                  onClick={(event) => { 
                    event.stopPropagation(); 
                    void copyArtifact(); 
                  }}
                  aria-label="Copy artifact"
                >
                  Copy
                </button>
                <button 
                  type="button" 
                  onClick={(event) => { 
                    event.stopPropagation(); 
                    void shareArtifact(); 
                  }}
                  aria-label="Share artifact"
                >
                  Share
                </button>
                <button 
                  type="button" 
                  onClick={(event) => { 
                    event.stopPropagation(); 
                    downloadArtifact(); 
                  }}
                  aria-label="Download artifact"
                >
                  Download
                </button>
                <button 
                  type="button" 
                  onClick={(event) => { 
                    event.stopPropagation(); 
                    openArtifactInTab(); 
                  }}
                  aria-label="Open in new tab"
                >
                  Open
                </button>
              </div>
            </article>
          )}
          
          {/* Refinement Row */}
          {active && (
            <div className="refinement-row" aria-label="Refine instruction">
              {REFINEMENTS.map((item) => (
                <button 
                  type="button" 
                  key={item} 
                  onClick={() => void refine(item)}
                  disabled={status === 'working' || isRateLimited || !isOnlineState}
                  aria-label={`Refine to make ${item.toLowerCase()}`}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
          
          {/* Version Selector */}
          {conversation && conversation.artifacts.length > 1 && (
            <div className="version-selector" aria-label="Select version">
              <span>Versions:</span>
              {conversation.artifacts.map((artifact) => (
                <button
                  key={artifact.version}
                  type="button"
                  className={artifact.version === conversation.activeVersion ? 'active' : ''}
                  onClick={() => setActiveVersion(artifact.version)}
                  aria-label={`Version ${artifact.version}`}
                >
                  v{artifact.version}
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Composer */}
        <form className="composer" onSubmit={handleSubmit}>
          <textarea
            ref={composerRef}
            rows={1}
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Skriv som du tænker…"
            aria-label="Compose input"
            disabled={status === 'working' || isRateLimited}
            className={isInputTooLong ? 'input-error' : ''}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && canSubmit) {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
          {isInputTooLong && (
            <div className="input-warning">
              {ERROR_MESSAGES.inputTooLong(MAX_INPUT_LENGTH)}
            </div>
          )}
          <div className="composer-row">
            <span>⌘ ⏎ to compose</span>
            <div className="composer-status">
              {status === 'working' && <LoadingSpinner size="small" />}
              {isRateLimited && <span className="status-warning">Rate limited</span>}
              {!isOnlineState && <span className="status-warning">Offline</span>}
            </div>
            <button 
              className="send-button" 
              disabled={!canSubmit}
              aria-label="Compose"
              type="submit"
            >
              ↑
            </button>
          </div>
        </form>
      </section>
      
      {/* Artifact Workspace */}
      <aside 
        className={selected ? 'artifact-workspace open' : 'artifact-workspace'} 
        aria-label="Selected artifact details"
      >
        {selected ? (
          <>
            <div className="workspace-head">
              <div>
                <p className="eyebrow">Artifact</p>
                <h2>{selected.title}</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setSelected(null)}
                aria-label="Close artifact"
                className="workspace-close"
              >
                ×
              </button>
            </div>
            
            <div className="workspace-tabs">
              <button className="active" type="button">Preview</button>
              <button type="button">Details</button>
            </div>
            
            <div className="workspace-meta">
              <div>
                <small>Target</small>
                <strong>{getTargetLabel(selected.target)}</strong>
              </div>
              <div>
                <small>Version</small>
                <strong>v{selected.version}</strong>
              </div>
              <div>
                <small>Status</small>
                <strong className="ready">● Ready</strong>
              </div>
              <div>
                <small>Created</small>
                <strong>{formatDate(selected.id.split('-')[0] as unknown as number)}</strong>
              </div>
            </div>
            
            <section>
              <h3>Objective</h3>
              <p>{selected.goal}</p>
            </section>
            
            {selected.successCriteria.length > 0 && (
              <section>
                <h3>Completion criteria</h3>
                <ul>
                  {selected.successCriteria.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </section>
            )}
            
            {selected.ambiguities.length > 0 && (
              <section className="decision-card">
                <h3>Needs clarity</h3>
                {selected.ambiguities.map((ambiguity, index) => (
                  <p key={index}>{ambiguity}</p>
                ))}
              </section>
            )}
            
            <section className="artifact-content">
              <h3>Instruction</h3>
              <pre><code>{selected.content}</code></pre>
            </section>
            
            <div className="workspace-actions">
              <button type="button" onClick={() => void copyArtifact()}>
                Copy
              </button>
              <button type="button" onClick={() => void shareArtifact()}>
                Share
              </button>
              <button type="button" onClick={downloadArtifact}>
                Download
              </button>
              <button type="button" onClick={openArtifactInTab}>
                Open in tab
              </button>
            </div>
          </>
        ) : (
          <div className="workspace-empty">
            <span>✦</span>
            <p>Vælg et artifact for at arbejde med det her.</p>
          </div>
        )}
      </aside>
    </main>
  );
}
