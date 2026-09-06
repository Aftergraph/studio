# Aftergraph UI Kernel + Living Interface v4 Design

## Status
Approved by product owner on 2026-09-05 with the explicit direction: inhouse product-layer components, low-level headless primitives allowed internally, and a live/immersive/dynamic interface with Motion/Framer-class animation behavior.

## Product intent
Aftergraph v4 must feel like a living work surface rather than a dashboard. The UI should reorganize around intent, work state, risk, attention and device. Motion communicates state, space communicates importance, and interaction communicates capability.

## Component ownership
The visible product API is entirely Aftergraph-owned. External primitives may be used behind the boundary for accessibility, positioning, focus and animation, but no external design-system component language is exposed to product code.

Packages:
- `@aftergraph/tokens`: semantic color, spacing, typography, depth, density and motion tokens.
- `@aftergraph/icons`: coherent line/symbol vocabulary.
- `@aftergraph/motion`: motion semantics, reduced-motion policy, shared-surface transitions and fallback Web Animations runtime.
- `@aftergraph/ui`: semantic components such as AGComposer, AGSurface, AGArtifact, AGTrajectory, AGApproval and AGNeedYou.
- `@aftergraph/runtime-ui`: deterministic surface composition from intent + work state + risk + attention + capability + device.

## Signature interaction language
1. **Surface Morphing**: inline objects can expand into peek, split, sheet or fullscreen surfaces without losing identity.
2. **Trajectory Flow**: live work is represented as progressive semantic steps, not spinner-only waiting.
3. **Attention Gravity**: consequential Needs You items change layout/focus rather than merely adding a notification badge.
4. **Evidence Reveal**: evidence is spatially linked to the result/action it supports.
5. **Agent Presence**: agents communicate state through restrained presence/motion, not decorative avatars.
6. **Outcome Settlement**: once work is verified, transient execution chrome collapses into a durable outcome/receipt.

## Motion classes
- Micro: 90–150ms, controls, selection, press, menu feedback.
- State: 160–260ms, task/agent/status changes, progress and evidence reveals.
- Surface: 260–420ms, split surfaces, artifact expansion, approval focus, inspectors.
- Ambient: bounded continuous motion only while work is active; must pause when inactive and respect `prefers-reduced-motion`.

## Core surfaces
- Chat/Work mode switch remains the primary product-level navigation.
- Projects and Recents remain unified and simple.
- Artifact is closed by default and morphs from inline result to split desktop surface or fullscreen mobile sheet.
- Context/Evidence inspectors are ephemeral.
- Destructive approvals become focused control surfaces with surrounding chrome visually de-emphasized.
- Human takeover is a mode change with explicit visual ownership.

## Live demo state
The reference build includes a deterministic local mission simulator to demonstrate live state without pretending to connect to production services. It can run, pause, resume, trigger an approval, verify the outcome and settle the UI.

## Visual system
Dark-first cinematic graphite/navy base with restrained blue/violet accents, translucent localized surfaces, crisp typography, low-chrome hierarchy and selective ambient depth. Glass is contextual, not app-wide decoration. Cards are used only for durable objects or consequential states.

## Accessibility and safety
- WCAG 2.2 AA target.
- Full keyboard access, visible focus, semantic native controls and focus trapping for modal surfaces.
- Reduced-motion mode retains all state changes with no essential information conveyed by animation alone.
- Destructive actions always preserve explicit what/why/impact/risk/evidence/rollback semantics.

## Cross-platform contract
Same semantic motion names across Web, Expo and SwiftUI; implementations may differ by platform. Web uses immediate Web Animations for cold/essential transitions and can use the Motion 13.2 adapter after an explicit idle/pre-warm load. Network discovery never blocks a user gesture. Expo maps to Reanimated/springs/haptics. SwiftUI maps to matched geometry, springs, symbol effects and native sheets.

## Non-goals
- Pixel-copying ChatGPT or Claude.
- A generic card/component catalog detached from Aftergraph semantics.
- Decorative ambient animation when no work is active.
- Arbitrary model-generated HTML/CSS.
