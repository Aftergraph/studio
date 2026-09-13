'use client';

import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { compileIntent, ComposeHttpError, ComposeProtocolError } from '../api';
import { mapCompileResponse } from '../presentation';
import {
  generateId,
  copyToClipboard,
  shareContent,
  downloadAsFile,
  isOnline,
  formatDate,
  scrollToBottom,
} from '../utils';
import {
  STORAGE_KEY,
  MAX_HISTORY_ITEMS,
  MAX_INPUT_LENGTH,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TARGETS,
  REFINEMENTS,
} from '../constants';
import type { ComposeTarget, ConversationItem, InstructionArtifactModel } from '../types';
import { useToast } from './Toast';
import { LoadingSpinner } from './LoadingSpinner';

type Status = 'idle' | 'working' | 'aborted' | 'error';

const RATE_LIMIT_WINDOW = 60_000;
const RATE_LIMIT_MAX = 30;

function getConversationTitle(item: ConversationItem): string {
  return item.title || item.artifacts.at(-1)?.title || item.source;
}

function getTargetLabel(target: string): string {
  return TARGETS.find((item) => item.value === target)?.label ?? target;
}

function loadHistory(): ConversationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as ConversationItem[]) : [];
  } catch {
    return [];
  }
}

export function ComposeShell() {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState<ComposeTarget>('auto');
  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [history, setHistory] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<InstructionArtifactModel | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState('');
  const [isOnlineState, setIsOnlineState] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [retryIn, setRetryIn] = useState(0);
  const [workspaceTab, setWorkspaceTab] = useState<'preview' | 'details'>('preview');

  const streamRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const rateLimitRef = useRef({ count: 0, windowStart: Date.now() });
  const statusRef = useRef<Status>('idle');
  const retryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toast = useToast();

  const active = useMemo(() => {
    if (!conversation) return null;
    return conversation.artifacts.find((item) => item.version === conversation.activeVersion) ?? null;
  }, [conversation]);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    const query = searchQuery.toLowerCase();
    return history.filter(
      (item) =>
        item.source.toLowerCase().includes(query) ||
        item.artifacts.some((a) => a.title.toLowerCase().includes(query)) ||
        (item.title?.toLowerCase().includes(query) ?? false),
    );
  }, [history, searchQuery]);

  const isInputTooLong = source.length > MAX_INPUT_LENGTH;
  const canSubmit = Boolean(source.trim()) && !isInputTooLong && status !== 'working' && isOnlineState;

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
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

  const saveHistory = useCallback((items: ConversationItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
    } catch {
      // localStorage full or unavailable
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveHistory(history);
    }, 300);
    return () => clearTimeout(timer);
  }, [history, saveHistory]);

  useEffect(() => {
    if (active) setSelected(active);
  }, [active]);

  useEffect(() => {
    if (status === 'working' || conversation) {
      scrollToBottom(streamRef.current, 'smooth');
    }
  }, [status, conversation]);

  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (statusRef.current === 'working') {
          e.preventDefault();
          cancelCompile();
        } else if (selected) {
          e.preventDefault();
          setSelected(null);
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        composerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    return () => {
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, []);

  function checkRateLimit(): boolean {
    const now = Date.now();
    const rl = rateLimitRef.current;
    if (now - rl.windowStart > RATE_LIMIT_WINDOW) {
      rl.count = 0;
      rl.windowStart = now;
    }
    if (rl.count >= RATE_LIMIT_MAX) {
      const secondsLeft = Math.ceil((rl.windowStart + RATE_LIMIT_WINDOW - now) / 1000);
      setIsRateLimited(true);
      setRetryIn(Math.max(0, secondsLeft));
      return false;
    }
    setIsRateLimited(false);
    return true;
  }

  function consumeRateLimit(): void {
    rateLimitRef.current.count++;
    rateLimitRef.current.windowStart = Date.now();
  }

  function persist(next: ConversationItem) {
    setConversation(next);
    setHistory((items) => [next, ...items.filter((item) => item.id !== next.id)]);
  }

  function cancelCompile() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
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
    if (!checkRateLimit()) {
      setError(ERROR_MESSAGES.rateLimitError);
      setStatus('error');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setStatus('working');
    setError('');
    consumeRateLimit();

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
        if (controller.signal.aborted) {
          setStatus('aborted');
          return;
        }
      }

      const message =
        cause instanceof ComposeHttpError
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

      if (cause instanceof ComposeHttpError && cause.status === 503) {
        if (retryTimerRef.current) clearInterval(retryTimerRef.current);
        let countdown = 5;
        setRetryIn(countdown);
        retryTimerRef.current = setInterval(() => {
          countdown -= 1;
          setRetryIn(countdown);
          if (countdown <= 0) {
            if (retryTimerRef.current) clearInterval(retryTimerRef.current);
            retryTimerRef.current = null;
            if (statusRef.current === 'error') {
              void runCompile(text, refinement);
            }
          }
        }, 1000);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }

  function handleSubmit(event?: FormEvent) {
    if (event) event.preventDefault();
    void runCompile(source);
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
      await copyArtifact();
    }
  }

  function downloadArtifact() {
    if (!selected) return;
    const filename = `artifact-v${selected.version}.md`;
    downloadAsFile(selected.content, filename, 'text/markdown');
    toast.success('Artifact downloaded');
  }

  function openArtifactInTab() {
    if (!selected) return;
    const blob = new Blob([selected.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function newChat() {
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
    setSelected(item.artifacts.find((a) => a.version === item.activeVersion) ?? item.artifacts.at(-1) ?? null);
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
    const title = editTitle.trim();
    if (!title) return;

    setHistory((items) =>
      items.map((item) => (item.id === editingConversationId ? { ...item, title } : item)),
    );

    if (conversation?.id === editingConversationId) {
      setConversation({ ...conversation, title });
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

  return (
    <main className="compose-shell" aria-label="Compose workspace">
      {status === 'working' && <LoadingSpinner overlay text="Understanding your intention..." />}

      {!isOnlineState && (
        <div className="offline-banner" role="alert" aria-live="assertive">
          <span className="offline-indicator" />
          <span>Working offline — some features limited</span>
        </div>
      )}

      {isRateLimited && (
        <div className="rate-limit-banner" role="alert" aria-live="polite">
          <span className="rate-limit-indicator" />
          <span>Rate limited — please wait {retryIn}s</span>
        </div>
      )}

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
            ＋ New chat
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
                      onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEditConversation();
                        }
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEditConversation();
                        }
                      }}
                      autoFocus
                    />
                    <button className="edit-save" onClick={saveEditConversation} aria-label="Save" type="button">
                      ✓
                    </button>
                    <button className="edit-cancel" onClick={cancelEditConversation} aria-label="Cancel" type="button">
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
                        ✎
                      </button>
                      <button
                        className="history-action-btn"
                        onClick={() => deleteConversation(item.id)}
                        aria-label="Delete conversation"
                        type="button"
                      >
                        ✕
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

        <div className="conversation-stream" aria-live="polite" ref={streamRef}>
          {!conversation && status === 'idle' && (
            <div className="welcome">
              <span className="welcome-mark">A</span>
              <h2>Skriv som du tænker.</h2>
              <p>Compose gør rå tanker til klare instruktioner, klar til den rigtige AI eller agent.</p>
            </div>
          )}

          {conversation && (
            <div className="turn user-turn" role="region" aria-label="Your input">
              <span className="avatar" aria-hidden="true">JA</span>
              <div>
                <p>{conversation.source}</p>
                <small>Original tanke</small>
              </div>
            </div>
          )}

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

          {status === 'aborted' && (
            <div className="turn compose-turn aborted" role="status">
              <span className="ai-mark" aria-hidden="true">A</span>
              <div>
                <strong>Compile annulleret</strong>
                <p>Du kan prøve igen når du er klar.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="error-card" role="alert" aria-live="assertive">
              <strong>Compile mislykkedes</strong>
              <p>{error}</p>
              <div className="error-actions">
                <button
                  type="button"
                  onClick={() => void runCompile(conversation?.source || source)}
                  disabled={status === 'working'}
                >
                  Prøv igen
                </button>
                {retryIn > 0 && <span className="retry-count">Retrying in {retryIn}s…</span>}
              </div>
            </div>
          )}

          {isRateLimited && !error && (
            <div className="warning-card" role="status">
              <strong>⚠ Rate Limited</strong>
              <p>Too many requests — please wait {retryIn}s</p>
            </div>
          )}

          {!isOnlineState && !error && (
            <div className="warning-card" role="status">
              <strong>⚠ Offline</strong>
              <p>Please check your internet connection</p>
            </div>
          )}

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
              <pre>
                <code>{active.content}</code>
              </pre>
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
            <div className="input-warning">{ERROR_MESSAGES.inputTooLong(MAX_INPUT_LENGTH)}</div>
          )}
          <div className="composer-row">
            <span>⌘ ⏎ to compose</span>
            <div className="composer-status">
              {status === 'working' && <LoadingSpinner size="small" />}
              {isRateLimited && <span className="status-warning">Rate limited</span>}
              {!isOnlineState && <span className="status-warning">Offline</span>}
            </div>
            <button className="send-button" disabled={!canSubmit} aria-label="Compose" type="submit">
              ↑
            </button>
          </div>
        </form>
      </section>

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
              <button
                className={workspaceTab === 'preview' ? 'active' : ''}
                type="button"
                onClick={() => setWorkspaceTab('preview')}
                aria-pressed={workspaceTab === 'preview'}
              >
                Preview
              </button>
              <button
                className={workspaceTab === 'details' ? 'active' : ''}
                type="button"
                onClick={() => setWorkspaceTab('details')}
                aria-pressed={workspaceTab === 'details'}
              >
                Details
              </button>
            </div>

            {workspaceTab === 'preview' && (
              <section className="artifact-content">
                <h3>Instruction</h3>
                <pre>
                  <code>{selected.content}</code>
                </pre>
              </section>
            )}

            {workspaceTab === 'details' && (
              <>
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
                    <strong>{formatDate(selected.createdAt)}</strong>
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
                  <pre>
                    <code>{selected.content}</code>
                  </pre>
                </section>
              </>
            )}

            <div className="workspace-actions">
              <button type="button" onClick={() => void copyArtifact()}>Copy</button>
              <button type="button" onClick={() => void shareArtifact()}>Share</button>
              <button type="button" onClick={downloadArtifact}>Download</button>
              <button type="button" onClick={openArtifactInTab}>Open in tab</button>
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
