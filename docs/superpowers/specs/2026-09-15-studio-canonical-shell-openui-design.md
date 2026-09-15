# Studio Canonical Shell + Governed OpenUI Design

## Status
Approved direction from the 2026-09-15 Studio UX review.

## Problem
Studio currently exposes the same system through multiple interaction idioms: Chat/Work/Space, contextual domains, the standalone Billing PWA, and public-site launch surfaces. Mobile also treats Space as a permanent primary mode and the live `/studio/*` build does not normalize its `/studio` base before routing. This produces duplicate-feeling interfaces, broken deep-link semantics, and inconsistent navigation.

## Product decision
There is exactly one interactive Aftergraph application shell: `aftergraph.org/studio/*`.

The public `aftergraph.org/*` worker remains the public platform/front door. It may link into Studio, but it does not host a second chat/work interface.

Studio owns the authenticated workspace experience. ChatGPT-style interaction patterns are used for shell/navigation density; Aftergraph remains the visual/semantic brand.

## Canonical navigation model

Desktop keeps persistent sidebar navigation. Mobile has only two permanent primary modes: Chat and Work. Space is contextual on mobile and opens from the sidebar, command palette, an object, or an explicit “Open in Space” action.

Canonical Studio routes:
- `/studio/` and `/studio/chat` -> Chat
- `/studio/work` -> Work
- `/studio/space` -> Space
- `/studio/projects` -> project/work collection
- `/studio/plugins` -> connected capability surface
- `/studio/remote` -> remote/device capability surface
- `/studio/settings` -> system/settings surface
- `/studio/billing` -> Billing entry surface; canonical financial writes remain Billing-owned
- `/studio/d/<DOMAIN>/o/<type>/<id>` -> typed object deep link

The same router must also work without the `/studio` prefix in local/backend-hosted development.

## Shell behavior

Mobile top chrome is intentionally minimal: menu button, centered Chat/Work segmented control, and a single context/profile action. The sidebar is a full-height sheet/drawer with Projects, Space, Billing, Plugins, Remote, Settings and recent conversations. Opening a destination closes the drawer.

Desktop keeps the sidebar visible and may expose Chat/Work/Space directly, but all destinations use the same shell and URL model. There are no separate chat shells for agents, projects, plugins, or products.

The shared composer remains the only primary input surface. Context chips, generated UI, artifact previews and action proposals appear inside Chat/Work rather than spawning a different chat product.

## Governed OpenUI boundary

OpenUI is not allowed to generate the application shell, global navigation, credentials UI, authority, arbitrary HTML, or direct endpoints. It remains behind the existing finite component registry and semantic interaction envelope.

Model output may compose allowlisted presentation and interaction components. Consequential actions continue through freshness -> capability -> authority -> policy/approval -> execution -> evidence. Generated actions never self-execute.

## Visual system

The shell moves from dense agent-console chrome toward a calm application workspace: neutral canvas, reduced glow, fewer nested borders, larger whitespace, subtle separators, large rounded mobile sheets, and Aftergraph blue/cyan reserved for meaningful control and active state.

Both light and dark modes remain supported. Mobile must meet 44px minimum primary touch targets, safe-area handling, no horizontal overflow at 390px, keyboard/focus accessibility, and non-color state labels.

Connection state is not rendered as a persistent warning banner. Freshness belongs in Active Context and object-level state; failures remain announced through accessible status messaging.

## Compatibility and invariants

- Preserve canonical domain ownership and existing Chat/Work/Space state semantics.
- Preserve Billing authority boundaries; shell integration does not move invoice authority into Studio/OpenUI.
- Preserve exact-head provenance, auth, backup and release gates.
- Preserve local `/chat`, `/work`, `/space` operation while adding `/studio/*` base awareness.
- No raw model HTML and no model-selected transport endpoints.
- No optimistic success for consequential actions.
- Existing deep links stay valid locally; `/studio` builds keep users inside `/studio` during navigation.

## Acceptance criteria

1. `/studio/chat`, `/studio/work`, and `/studio/space` render the intended Studio mode after Cloudflare base-path rewriting.
2. Mobile primary navigation contains exactly Chat and Work; Space remains reachable from the mobile drawer and command palette.
3. Mobile drawer is keyboard/focus operable, closes on navigation, and exposes Projects, Space, Billing, Plugins, Remote and Settings in one shell.
4. Desktop retains one persistent Studio sidebar and one global composer model.
5. Generated OpenUI surfaces still pass registry, freshness, capability and authority tests.
6. 390px browser QA has no horizontal overflow and primary controls are >=44px.
7. Existing release, fullstack, polyrepo, secrets and a11y gates remain green apart from the documented local Pillow-only baseline where applicable.
8. Production static artifact and backend report the same exact Studio SHA before the deploy is considered complete.
9. Public smoke confirms `/studio/`, `/studio/chat`, `/studio/work`, `/studio/space`, `/studio/version.json` and `/studio/healthz` at the deployed SHA.

## Deployment model

Production remains two coordinated artifacts with one provenance SHA: the versioned Studio backend on the VDS and the `aftergraph-studio` Cloudflare Worker static artifact. Backend activates first with health/ready verification; Cloudflare Studio deploy follows using the exact same merged Studio commit SHA. Rollback repoints the backend release symlink and uses Cloudflare Worker rollback if public verification fails.
