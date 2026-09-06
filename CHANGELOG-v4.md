# Aftergraph Workspace v4 changelog

## Living Interface + inhouse UI Kernel

V4 builds on the simplified Chat/Work shell from v3 and moves product differentiation into first-party semantic components, live state and contextual motion.

### Added

- `@aftergraph/ui`, `@aftergraph/motion`, `@aftergraph/tokens`, `@aftergraph/icons`, `@aftergraph/runtime-ui` local package boundaries.
- Semantic components for trajectory, artifact, approval, Needs You, composer, agent presence, agent cluster, action dock, outcome receipt, command palette and Pulse Rail.
- Deterministic live mission simulator with run/pause/resume, approval pause, verification and settlement.
- Peripheral `AGPulseRail` with explicit progressive disclosure.
- Contextual action dock rather than duplicated primary controls.
- Live semantic state on conversation surfaces.
- Pointer-reactive ambient field with reduced-motion policy.
- Resizable desktop artifact split with keyboard-accessible separator.
- Mobile fullscreen artifact and native-like approval sheet behavior.
- V4-complete service worker cache for the living interface runtime and local packages.

### Changed

- Increased conversational/readability scale and reduced console-like density.
- Motion now represents lifecycle transitions rather than every render.
- Artifact morph begins in the same render lifecycle, preventing a visible flash/reset.
- Optional Motion/Framer-class runtime discovery is no longer initiated from a user gesture; essential transitions use immediate local Web Animations.
- Live mission updates preserve user-owned chat scroll position unless the user explicitly chooses to follow latest.
- Approval entrance animation is spatially isolated from the centered shell so animation cannot overwrite layout transforms.
- Chat grid rows explicitly own live strip/action dock/composer placement, eliminating optional-surface overlap.
- PWA theme/cache metadata updated from v3 to v4.

### Fixed during QA

- Approval centering broke when animation and layout both owned `transform`.
- Duplicate `Run live` controls created ambiguous interaction ownership.
- Live strip could occupy the flexible message row and overlap the Action Dock.
- Artifact morph could flash because optional Motion loading delayed animation start.
- Artifact/approval transitions could visually restart on internal state/rerender changes.
- Background progress updates could force the conversation back to the latest message while the user was reading older content.
- V3 service-worker cache omitted V4 runtime/package assets.

### Preserved

- canonical nine-domain architecture under the hood;
- Chat/Work primary human modes;
- explicit authority, risk, impact, rollback, evidence and audit semantics;
- human takeover / hand-back;
- reduced-motion behavior;
- offline/local reference operation.
