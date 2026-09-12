# Interaction Fabric v1 — Wave 0/1 Evidence

## Scope

This evidence bundle closes only Studio Wave 0/1 for the Production Interaction Fabric convergence program.

It proves ownership/drift measurement, Studio interaction ownership guards, typed non-authoritative interaction projections, tenant-safe workspace binding, Studio-owned Project/Recent reference records, and explicit classification of the legacy local conversation path as reference-only.

It does not claim a production Studio↔Runtime chat adapter, durable WORKS composition, Relay operator composition, Sentinel end-to-end verification, production database migration, or platform L3/L4/L5 conformance.

## Exact source cuts

- Studio implementation HEAD before evidence close: `0a4882c28c2e7ac518361beb2bb48a7ff65abacf`
- Studio design baseline / current `origin/main`: `390ef650ca9a807c8f03dafbe0757a82fbccc763`
- Governance `origin/main`: `1689e32ef124e595d3e71e960932093e0412194e`
- Reviewed Studio upstream manifest SHA-256: `a7f9f0b7d1f77a7bc7c3336acc6e4054e26660a9120d92ccbe8cd3f7321b77b6`
- Generated ownership audit SHA-256: `34241aafc80723a8cd070d2e2b2a576130fe6c83867da3d96361eae47c37e945`

## Ownership/drift result

The audit was generated from Governance `origin/main`, not the stale local checkout.

- Topology repositories: 28
- Org-state repositories: 28
- Experience-plane repositories: `relay`, `studio`, `wi-frontend`
- Reviewed integrations currently matching live org-state: 0
- Reviewed integrations with head drift: 5
- Topology repositories not represented in Studio's reviewed manifest: 23

Expected drift is evidence, not a test failure. The audit never rewrites ownership or silently repins reviewed contracts.

## Interaction ownership invariants

Studio owns `InteractionSurface` and `AssistantProfile` presentation. Runtime remains owner of `InteractionThread`, `InteractionTurn`, `Presence`, and `HandoffCheckpoint`. Trust Gateway remains owner of tenant binding, WORKS owns durable work, and Sentinel owns verification verdicts.

The Studio projection is intentionally `authoritative:false` and may carry opaque references only. Embedded thread, turn, authority, execution, or verification truth is rejected.

## Verification commands

Targeted Wave 0/1 verification:

```bash
node --test \
  tests/interaction-ownership-audit.test.mjs \
  tests/interaction-ownership-boundary.test.mjs \
  tests/interaction-projection.test.mjs \
  tests/workspace-experience.test.mjs \
  tests/project-recents.test.mjs \
  tests/state.test.mjs \
  tests/fullstack-api-v4.test.mjs
```

Full verification uses the current CI visual prerequisites from an isolated Python environment containing only Pillow and NumPy:

```bash
PATH="/tmp/studio-baseline-venv/bin:$PATH" npm test
PATH="/tmp/studio-baseline-venv/bin:$PATH" npm run verify
```

## Fresh verification result

Verified on the Wave 0/1 tree before evidence close:

- Targeted Wave 0/1 suite: 51/51 passed.
- Full Studio suite: 669/669 passed, 0 failed, 0 skipped.
- `npm run verify`: exit 0 and `ALL WORKSPACE V5 VERIFY CHECKS PASS`.
- `git diff --check`: clean.
- No obvious credential patterns were found in branch-added tracked files.
- Existing legacy AVC integration code remains outside this wave; this wave introduces no new AVC product/runtime identifier. Historical migration wording in the design document is provenance only.

The local Governance working checkout was 91 commits behind `origin/main`; therefore the committed ownership report was generated from files extracted from exact Governance `origin/main` SHA `1689e32ef124e595d3e71e960932093e0412194e`, not from that stale worktree.
