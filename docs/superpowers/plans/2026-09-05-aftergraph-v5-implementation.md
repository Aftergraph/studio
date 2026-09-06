# Aftergraph V5 Agentic Operating Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the first complete V5 vertical slice: persistent Space mode, semantic zoom, presence, visualization, multimodal composer, replay and attention-aware spatial composition on top of the verified V4 full-stack runtime.

**Architecture:** Preserve V4 domain/runtime contracts. Add serializable spatial and replay state to canonical workspace state, new first-party packages for spatial/presence/interaction/visualization/composer, and expose Space through the existing human shell while keeping all canonical domains accessible contextually.

**Tech Stack:** Node.js 22 ESM, browser-native HTML/CSS/JS, SVG visualization, Web Animations API with existing optional Motion adapter, Playwright QA, Expo/SwiftUI source parity.

**Spec:** `docs/superpowers/specs/2026-09-05-aftergraph-v5-agentic-operating-environment-design.md`

## Global Constraints

- Preserve all V4 tests and semantic domain ownership.
- Chat, Work and Space are the only permanent primary modes.
- No correctness dependency on animation runtime.
- Spatial state must be serializable and persisted by the existing durable state store.
- Keyboard and touch alternatives must exist for spatial actions.
- Every high-risk action remains approval/evidence controlled.

---

### Task 1: V5 kernel and spatial state
- [x] Add failing tests for Space mode, spatial state and semantic zoom.
- [x] Implement `@aftergraph/spatial` and canonical V5 state fields.
- [x] Verify V4 regression suite remains green.

### Task 2: Presence and visualization
- [x] Add failing tests for live presence and semantic visualization output.
- [x] Implement `@aftergraph/presence` and `@aftergraph/visualization`.
- [x] Verify accessible SVG and follow-agent contracts.

### Task 3: Multimodal composer and interaction semantics
- [x] Add failing tests for contextual composer and interaction commands.
- [x] Implement `@aftergraph/composer` and `@aftergraph/interaction`.
- [x] Integrate Chat/Work/Space intent modes.

### Task 4: Replay/time layer and server persistence
- [x] Add failing tests for replay snapshots and spatial API persistence.
- [x] Implement replay model and `/api/v1/spaces/*` contracts.
- [x] Verify restart durability.

### Task 5: Space UI and attention physics
- [x] Add source/browser tests for spatial mode, docking, focus and semantic zoom.
- [x] Integrate V5 packages into the main shell.
- [x] Add V5 visual/motion layer without card-grid regressions.

### Task 6: Native/PWA parity and final QA
- [x] Add Expo/SwiftUI source parity contracts for Space semantics.
- [x] Upgrade service worker/package metadata to V5.
- [x] Run unit, full-stack, source, platform, browser, accessibility and archive verification.
- [x] Package ZIP and SHA-256 only after all gates are fresh-green.
