# Aftergraph Workspace v3 changelog

## Benchmark-driven UX rebuild

v3 is a deliberate second simplification pass after v2. The core change is not visual decoration; it is reduction of permanent product architecture.

### Navigation
- Replaced `Today · Chat · Work · Library` primary navigation with **Chat · Work** modes.
- Removed permanent `Agents` and `Connections` destinations from normal chrome.
- Added **Projects** and **Unified Recents** to the sidebar.
- Kept **Artifacts** directly discoverable as the only persistent utility destination.
- Preserved all 9 canonical Aftergraph domains through search/commands/context.

### Chat
- Artifact is now **closed by default**.
- Removed Chat / Plan / Evidence / Agents tab strip from the conversation.
- Removed dashboard metric-card treatment from live results.
- Increased conversational text scale and reading rhythm.
- Replaced agent cards with compact run/progress lines.
- Reduced metadata around each assistant turn.
- Simplified composer chrome while retaining advanced modes.

### Work
- Removed the second persistent mission-list rail.
- Work now uses one focused mission surface.
- Artifact can split beside Work only when opened.
- Takeover / hand-back remains available without adding permanent control chrome.

### Artifacts
- Desktop: dedicated split pane.
- Mobile: full-screen work surface.
- Chat remains visible and stable when an artifact is opened/closed.
- Version/detail tabs remain available in the artifact surface.

### Control
- Approval icon now opens a **contextual focused approval overlay**.
- Reviewing approval no longer forces a navigation detour to the Control domain.
- Impact, authority, risk, evidence and rollback remain explicit.

### Mobile/native
- Removed four-item bottom navigation from the web/mobile shell.
- Chat / Work remain the primary mobile modes.
- Expo source now exposes Chat / Work as the primary tabs; Today/Library sources remain contextual.
- SwiftUI root now exposes Chat / Work as primary tabs.

### Benchmark basis
See `BENCHMARK-CHATGPT-CLAUDE-2026-09-05.md`.
