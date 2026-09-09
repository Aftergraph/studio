# Accessibility Standard

- WCAG 2.2 AA is the minimum for public surfaces; body text targets 4.5:1 and large text/UI graphics 3:1.
- Status is never color-only. Every state asset has a distinct shape and a text alternative.
- `verified`, `stale`, `revoked`, and `conflict` use check, clock, break, and split geometry respectively.
- SVGs intended as standalone images require `role="img"` and an accessible label. Decorative SVGs use `aria-hidden="true"` at the consuming surface.
- Reduced-motion mode removes path travel, pulses, and automatic parallax; the final state remains visible.
- Diagrams require an adjacent prose or table alternative describing nodes, edges, direction, and state.
- Text may not be rasterized into architecture diagrams. Social cards are an exception only because an equivalent metadata title/description exists in the page.
- Small marks must use `identity/aftergraph-micro-mark.svg`; the detailed monogram is not permitted below 24 px.

