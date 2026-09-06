# Aftergraph Workspace v3 Design

## Goal

Bring Aftergraph to the same usability complexity ceiling as current ChatGPT and Claude while keeping Aftergraph-only trust, evidence and human-control semantics.

## Shell

Permanent human modes: **Chat** and **Work**.

Sidebar information architecture:

- New chat
- Search / command palette
- Projects
- Unified Recents (Chat + Work)
- Artifacts
- Workspace switcher

The canonical nine-domain architecture remains hidden from permanent chrome and reachable through Cmd/Ctrl-K, deep links and contextual surfaces.

## Chat

- centered reading column;
- artifact closed by default;
- no Chat/Plan/Evidence/Agents tab strip;
- user messages use restrained bubbles;
- assistant output is open prose;
- agent progress is a compact run line;
- significant output becomes a durable Artifact;
- advanced intent modes stay in the composer but are visually secondary.

## Work

Work owns mission-level progress, agent ownership, budget, evidence, approvals and takeover. It uses one focused mission canvas rather than a second permanent list rail.

## Artifact

Desktop: split beside Chat/Work.
Mobile: full-screen surface.

Artifact versioning and details remain separate from the conversation.

## Context and control

Context is ephemeral. Approval is modal/focused and preserves the current Chat/Work mode. High-risk actions expose impact, authority, risk, evidence and rollback before execution.

## Mobile/native

Primary mobile modes remain Chat/Work. Context and artifacts use sheets/full-screen presentation. Expo and SwiftUI implementations follow platform-native navigation primitives rather than recreating the desktop rail.

## Quality bar

- WCAG-oriented accessible names and focus handling.
- Cmd/Ctrl-K command palette with focus trap.
- No horizontal overflow at 390px.
- Reduced-motion support.
- No arbitrary generated HTML/CSS for dynamic surfaces.
- Canonical domains remain contract-pinned by tests.
