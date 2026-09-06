# Aftergraph Workspace v3 Implementation Plan

> **For agentic workers:** This plan was executed locally with TDD-style red/green verification and browser checkpoints.

**Goal:** Reduce permanent UX complexity to Chat/Work + Projects/Recents/Artifacts while preserving Aftergraph control/evidence capabilities contextually.

**Architecture:** Keep the existing local domain/state/compose contracts. Replace only the human shell and surface composition. Preserve the nine canonical domains behind search, deep links and contextual surfaces.

**Tech Stack:** ES modules, semantic HTML, CSS, Node 22, Playwright Chromium QA, Expo source, SwiftUI source.

**Spec:** `docs/superpowers/specs/2026-09-05-workspace-v3-design.md`

## Tasks

- [x] Benchmark current ChatGPT Chat/Work + Projects/Unified Recents behavior.
- [x] Benchmark current Claude Projects + dedicated/versioned Artifacts behavior.
- [x] Add failing v3 shell contract tests.
- [x] Implement Chat/Work primary mode contract while pinning nine canonical domains.
- [x] Replace v2 sidebar with Projects + Unified Recents + Artifacts.
- [x] Close Artifact by default and verify desktop split behavior.
- [x] Remove Chat tab-strip/dashboard metric treatment.
- [x] Reduce agent execution to compact inline state.
- [x] Replace Work list rail with focused mission surface.
- [x] Make approval overlay contextual and mode-preserving.
- [x] Remove four-item mobile bottom navigation.
- [x] Align Expo and SwiftUI primary navigation to Chat/Work.
- [x] Run Node tests, source checks, platform checks and browser smoke tests.
- [x] Capture clean desktop, Artifact, Control and mobile reference screenshots.
- [x] Package final ZIP and SHA-256 after final verification.
