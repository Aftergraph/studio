'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { compileIntent } from '../api';
import { mapCompileResponse } from '../presentation';
import type { ComposeTarget, ConversationItem, InstructionArtifactModel } from '../types';

const targets: Array<{ value: ComposeTarget; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'friday.chatgpt', label: 'Friday / ChatGPT' },
  { value: 'anthropic.claude-code', label: 'Claude Code' },
  { value: 'openai.codex', label: 'Codex' },
  { value: 'aftergraph.hermes', label: 'Hermes' },
  { value: 'generic', label: 'Generic' },
];

const refinements = ['Clearer', 'More detailed', 'Shorter', 'More autonomous', 'Safer', 'Execution-ready'];
const storageKey = 'aftergraph.compose.conversations.v1';

function loadHistory(): ConversationItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey) || '[]') as ConversationItem[];
  } catch {
    return [];
  }
}

function targetLabel(target: string) {
  return targets.find((item) => item.value === target)?.label ?? target;
}

export function ComposeShell() {
  const [source, setSource] = useState('');
  const [target, setTarget] = useState<ComposeTarget>('auto');
  const [conversation, setConversation] = useState<ConversationItem | null>(null);
  const [history, setHistory] = useState<ConversationItem[]>([]);
  const [selected, setSelected] = useState<InstructionArtifactModel | null>(null);
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => setHistory(loadHistory()), []);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 40)));
    }
  }, [history]);

  const active = useMemo(() => {
    if (!conversation) return null;
    return conversation.artifacts.find((item) => item.version === conversation.activeVersion) ?? null;
  }, [conversation]);

  useEffect(() => {
    if (active) setSelected(active);
  }, [active]);

  function persist(next: ConversationItem) {
    setConversation(next);
    setHistory((items) => [next, ...items.filter((item) => item.id !== next.id)]);
  }

  async function runCompile(raw: string, refinement?: string) {
    const text = raw.trim();
    if (!text || status === 'working') return;
    setStatus('working');
    setError('');
    try {
      const nextVersion = (conversation?.artifacts.length ?? 0) + 1;
      const result = await compileIntent(text, target, refinement);
      const artifact = mapCompileResponse(result, nextVersion);
      const next: ConversationItem = conversation
        ? { ...conversation, activeVersion: nextVersion, artifacts: [...conversation.artifacts, artifact] }
        : { id: crypto.randomUUID(), source: text, createdAt: Date.now(), activeVersion: 1, artifacts: [artifact] };
      persist(next);
      setSelected(artifact);
      setSource('');
      setStatus('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Compose kunne ikke færdiggøre instruktionen.');
      setStatus('error');
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    await runCompile(source);
  }

  async function refine(label: string) {
    if (!conversation) return;
    await runCompile(conversation.source, label);
  }

  async function copyArtifact() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.content);
  }

  async function shareArtifact() {
    if (!selected) return;
    if (navigator.share) {
      await navigator.share({ title: selected.title, text: selected.content });
      return;
    }
    await copyArtifact();
  }

  function newChat() {
    setConversation(null);
    setSelected(null);
    setSource('');
    setStatus('idle');
    setError('');
  }

  function openConversation(item: ConversationItem) {
    setConversation(item);
    setSelected(item.artifacts.find((artifact) => artifact.version === item.activeVersion) ?? item.artifacts.at(-1) ?? null);
  }

  return (
    <main className="compose-shell">
      <aside className="compose-sidebar" aria-label="Compose history">
        <div className="brand-lockup"><span className="brand-mark">A</span><div><strong>Aftergraph</strong><small>From thought to action.</small></div></div>
        <button className="new-chat" type="button" onClick={newChat}>＋ New chat</button>
        <div className="side-label">History</div>
        <nav className="history-list">
          {history.length === 0 ? <p className="empty-history">Dine samtaler vises her.</p> : history.map((item) => (
            <button className={conversation?.id === item.id ? 'history-row active' : 'history-row'} key={item.id} onClick={() => openConversation(item)} type="button">
              <span>{item.artifacts.at(-1)?.title || item.source}</span><small>v{item.activeVersion}</small>
            </button>
          ))}
        </nav>
        <div className="authority-note"><span className="status-dot" />Intelligence under your authority</div>
      </aside>

      <section className="conversation-pane">
        <header className="compose-topbar">
          <div><p className="eyebrow">Aftergraph</p><h1>Compose</h1></div>
          <label className="target-control">Target<select value={target} onChange={(event) => setTarget(event.target.value as ComposeTarget)}>{targets.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        </header>

        <div className="conversation-stream" aria-live="polite">
          {!conversation && status === 'idle' ? (
            <div className="welcome"><span className="welcome-mark">A</span><h2>Skriv som du tænker.</h2><p>Compose gør rå tanker til klare instruktioner, klar til den rigtige AI eller agent.</p></div>
          ) : null}

          {conversation ? <div className="turn user-turn"><span className="avatar">JA</span><div><p>{conversation.source}</p><small>Original tanke</small></div></div> : null}

          {status === 'working' ? <div className="turn compose-turn working"><span className="ai-mark">A</span><div><strong>Forstår din intention…</strong><p>Finder mål, constraints og den rigtige struktur uden at udvide din authority.</p><div className="progress-line"><span /></div></div></div> : null}

          {error ? <div className="error-card" role="alert"><strong>Compile mislykkedes</strong><p>{error}</p><button type="button" onClick={() => runCompile(conversation?.source || source)}>Prøv igen</button></div> : null}

          {active ? <article className="artifact-card" onClick={() => setSelected(active)}>
            <div className="artifact-card-head"><span>✦ Instruction artifact</span><span className="version-pill">v{active.version}</span></div>
            <h2>{active.title}</h2><p>{active.goal}</p>
            <div className="artifact-meta"><span>{targetLabel(active.target)}</span><span>{Math.round(active.confidence * 100)}% confidence</span><span>Ready</span></div>
            <pre>{active.content}</pre>
            <div className="artifact-actions"><button type="button" onClick={(event) => { event.stopPropagation(); void copyArtifact(); }}>Copy</button><button type="button" onClick={(event) => { event.stopPropagation(); void shareArtifact(); }}>Share</button><button type="button">Open artifact</button></div>
          </article> : null}

          {active ? <div className="refinement-row" aria-label="Refine instruction">{refinements.map((item) => <button type="button" key={item} onClick={() => void refine(item)} disabled={status === 'working'}>{item}</button>)}</div> : null}
        </div>

        <form className="composer" onSubmit={submit}>
          <textarea rows={1} value={source} onChange={(event) => setSource(event.target.value)} placeholder="Skriv som du tænker…" aria-label="Compose input" />
          <div className="composer-row"><span>⌘ ↵ to compose</span><button className="send-button" disabled={!source.trim() || status === 'working'} aria-label="Compose" type="submit">↑</button></div>
        </form>
      </section>

      <aside className={selected ? 'artifact-workspace open' : 'artifact-workspace'} aria-label="Selected artifact">
        {selected ? <>
          <div className="workspace-head"><div><p className="eyebrow">Artifact</p><h2>{selected.title}</h2></div><button type="button" onClick={() => setSelected(null)} aria-label="Close artifact">×</button></div>
          <div className="workspace-tabs"><button className="active" type="button">Preview</button><button type="button">Details</button></div>
          <div className="workspace-meta"><div><small>Target</small><strong>{targetLabel(selected.target)}</strong></div><div><small>Version</small><strong>v{selected.version}</strong></div><div><small>Status</small><strong className="ready">● Ready</strong></div></div>
          <section><h3>Objective</h3><p>{selected.goal}</p></section>
          {selected.successCriteria.length ? <section><h3>Completion criteria</h3><ul>{selected.successCriteria.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
          {selected.ambiguities.length ? <section className="decision-card"><h3>Needs clarity</h3><p>{selected.ambiguities[0]}</p></section> : null}
          <section className="artifact-content"><h3>Instruction</h3><pre>{selected.content}</pre></section>
          <div className="workspace-actions"><button type="button" onClick={() => void copyArtifact()}>Copy</button><button type="button" onClick={() => void shareArtifact()}>Share</button></div>
        </> : <div className="workspace-empty"><span>✦</span><p>Vælg et artifact for at arbejde med det her.</p></div>}
      </aside>
    </main>
  );
}
