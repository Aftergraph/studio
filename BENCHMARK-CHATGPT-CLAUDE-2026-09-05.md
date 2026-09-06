# Aftergraph Workspace v3 — ChatGPT / Claude benchmark

Date: 2026-09-05

This benchmark is intentionally split into two layers:

1. **Verified current product behavior** from current OpenAI and Anthropic product/help material.
2. **Design inference** used to refine Aftergraph. Visual spacing and pixel measurements are not claimed as live-product facts because this build environment cannot inspect authenticated ChatGPT/Claude DOM/CSS directly.

## Current product facts used

### ChatGPT

Current OpenAI documentation (July–September 2026) states that the new desktop experience has:

- a global ChatGPT/Codex switch;
- **Chat** and **Work** as the two ChatGPT modes;
- **Unified Recents** for Chat and Work threads;
- existing **Projects** available in the desktop app;
- Project context usable for either Chat or Work;
- cloud Work continuity across desktop, web and mobile;
- Work capable of creating finished documents, spreadsheets, presentations, reports and Sites.

Sources:
- https://help.openai.com/en/articles/20001276-moving-to-the-new-chatgpt-desktop-app
- https://help.openai.com/en/articles/20001275
- https://help.openai.com/en/articles/10169521-projects-in-chatgpt
- https://openai.com/index/chatgpt-for-your-most-ambitious-work/

### Claude

Current Anthropic material confirms:

- Projects ground conversations in project knowledge and custom instructions;
- substantial standalone output is separated from the conversation as an **Artifact**;
- Artifacts use a dedicated surface rather than treating the chat thread as the deliverable;
- the updated artifact system (from 2026-08-19) makes new artifacts durable, shareable and versioned;
- Cowork can create interactive artifacts and use connected apps subject to the viewer's own access.

Sources:
- https://www.anthropic.com/news/projects
- https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them
- https://support.claude.com/en/articles/14729249-use-artifacts-in-claude-cowork

A contemporary UX teardown also describes the Claude split-pane pattern as conversation + standalone deliverable, which is consistent with Anthropic's own artifact documentation:
- https://aiuxplayground.com/teardowns/claude/artifacts/

## 1:1 interaction comparison

| Dimension | ChatGPT current pattern | Claude current pattern | Aftergraph v2 problem | Aftergraph v3 response |
|---|---|---|---|---|
| Primary modes | Chat / Work | Conversation + deeper work/Cowork | Today / Chat / Work / Library plus utilities | **Chat / Work only** as permanent modes |
| History | Unified Chat + Work Recents | Conversation history in primary navigation | Multiple navigation concepts competed | **Unified Recents** with Chat/Work type indicator |
| Long-lived context | Projects | Projects | Project context visually weak | **Projects first-class in sidebar** |
| Output | Work can create finished materials | Dedicated Artifacts | Artifact was open by default and felt dashboard-like | **Artifact closed by default; opens only when requested** |
| Artifact layout | Separate Work/document surfaces when needed | Dedicated artifact window alongside conversation | Permanent right-hand weight | **True contextual split pane** on desktop, full-screen on mobile |
| Conversation | Primary reading surface | Primary reading surface | Too many tabs, statuses and cards | **Single reading column, no Chat/Plan/Evidence/Agents tab bar** |
| Composer | Central command/input surface | Central prompt surface | Seven modes constantly visible | Modes retained, but **collapsed into low-chrome composer controls** |
| Search/commands | Search / project/history navigation | Search + project/artifact navigation | Command palette existed but competed with nav | **Search + Cmd/Ctrl-K as universal access path** |
| Mobile | Chat/Work continuity, reduced chrome | Conversation-first, artifact surface when needed | Four permanent bottom tabs | **No four-tab bottom nav; Chat/Work remain the primary modes** |
| Approval/control | Product permission prompts | Tool/access prompts | Separate Control destination encouraged dashboard detours | **Approval is a contextual focused overlay without leaving current mode** |
| Agent execution | Work performs tasks end to end | Cowork/Claude can perform longer work | Agent state overexposed | **Compact run line; detailed state lives in Work/context** |
| Canonical complexity | Hidden from normal user | Hidden from normal user | 9-domain model leaked into UX | **9 domains stay canonical but are command/context reachable** |

## Design rules frozen for v3

1. **Two permanent modes maximum:** Chat and Work.
2. **Projects + Unified Recents** own normal navigation.
3. Canonical domains are architecture, not a menu.
4. Chat defaults to a clean reading surface.
5. Durable output is a separate Artifact, not a giant chat card.
6. Artifact is closed until it becomes relevant or the user opens it.
7. Approval, context, evidence and agent detail are contextual surfaces.
8. Mobile uses platform-scale navigation rather than reproducing desktop IA.
9. No default dashboard/card-grid treatment inside conversation.
10. Aftergraph differentiation remains **human control + evidence + durable work**, but it must appear only at the moment it helps a decision.

## Where Aftergraph should intentionally differ

A literal clone would throw away the product's strongest semantics. v3 therefore keeps these Aftergraph-only capabilities:

- explicit approval impact / risk / rollback / evidence;
- human takeover and hand-back;
- verified vs merely completed outcomes;
- durable work/execution state;
- evidence/provenance;
- capability-aware dynamic composition;
- canonical nine-domain model underneath the simplified shell.

The product rule is therefore:

> Match competitor simplicity at rest. Reveal Aftergraph depth only when work, risk or verification makes it useful.
