# Aftergraph V5 Agentic Operating Environment Design

## Product contract

Aftergraph V5 evolves the V4 Living Interface into a spatial, contextual agentic operating environment. The public mental model remains deliberately small: Chat, Work, Space, Projects and Recents. Canonical domains remain durable internal ownership boundaries rather than navigation clutter.

## Invariants

1. Objects persist; surfaces adapt.
2. Space is first-class: AGSpace -> AGRegion -> AGSurface.
3. Time is first-class: event history, replay cursor and snapshots are durable state.
4. Presence is first-class for humans and agents.
5. Composition is contextual: intent + work + risk + attention + capabilities + device.
6. Every consequential autonomous action remains governable through authority, evidence, approval, rollback and takeover.
7. Motion communicates state and never owns correctness.
8. Reduced-motion, keyboard and mobile flows have complete functional parity.

## Packages

Existing: @aftergraph/ui, @aftergraph/motion, @aftergraph/tokens, @aftergraph/icons, @aftergraph/runtime-ui.

New: @aftergraph/spatial, @aftergraph/presence, @aftergraph/interaction, @aftergraph/visualization, @aftergraph/composer.

## V5 first implementation slice

The first V5 build ships an integrated vertical slice rather than isolated mock components:

- Space mode as the third primary mode.
- Persistent spatial layouts with dock/stack/focus actions.
- Semantic zoom Mission -> Task -> Agent -> Action -> Evidence.
- Live agent/human presence with follow-agent interaction.
- First-party trajectory/evidence visualizations.
- Multimodal intent composer with context and capability modes.
- Mission replay/time surface from durable event history.
- Attention-aware layout composition and focus mode.
- Server contracts for spatial state and replay state.
- Web, PWA and native-source parity contracts.

## Performance and UX constraints

- No whole-workspace rerender for progress-only runtime ticks.
- No primary action depends on hover or animation.
- Spatial dragging has keyboard alternatives.
- Surface state is serializable and recoverable.
- Animations are interruptible and disabled/reduced under prefers-reduced-motion.
- No default card-grid dashboard design.
