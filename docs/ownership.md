# V8.1 Ownership Map

Maskinlæsbar ejerskabs-map for alle P0/P1/P2 findings i frontend-todos.md.

Ejere er **roller** (ikke personer): `design-system`, `frontend`, `backend`, `docs`.

Status: `untracked` | `assigned` | `done`

## Map

| Finding ID | Title | Owner | Priority | Status |
|---|---|---|---|---|
| V81-001 | Raw color cluster bypasses semantic tokens | design-system | P1 | assigned |
| V81-002 | Repeated spacing and dimensions lack an explicit scale | design-system | P1 | assigned |
| V81-003 | Z-index values are not centrally owned | design-system | P1 | assigned |
| V81-004 | Breakpoints are duplicated across CSS layers | frontend | P1 | assigned |
| V81-005 | API paths are embedded in clients and runtime helpers | frontend | P1 | assigned |
| V81-006 | Navigation and domain metadata are split across registries | frontend | P1 | assigned |
| V81-007 | Runtime mock data is mixed with initial production shell state | backend | P0 | done |
| V81-008 | Status strings and presentation mappings are distributed | frontend | P1 | assigned |
| V81-009 | Currency and number formatting is locally formatted | frontend | P1 | assigned |
| V81-010 | Direct localStorage ownership in bootstrap | frontend | P1 | assigned |
| V81-011 | Inline runtime styles bypass component tokens | frontend | P2 | assigned |
| V81-012 | Accessibility state coverage is not represented as a shared contract | frontend | P1 | assigned |
| V81-013 | Hardcoded UI copy is embedded in render functions | docs | P2 | assigned |
| V81-014 | State booleans permit invalid combinations | frontend | P1 | assigned |
| V81-015 | Backend response assumptions lack a single validation boundary | backend | P0 | done |
| V81-016 | Destructive action protection is not one shared primitive | backend | P0 | done |
| V81-017 | Duplicate component primitives and local variants need consolidation review | design-system | P1 | assigned |
| V81-018 | Dead/legacy markers require classification before cleanup | docs | P2 | assigned |
| V81-019 | Responsive audit needs explicit narrow/tablet/wide evidence | frontend | P1 | assigned |
| V81-020 | Canonical ownership is undocumented for several frontend constants | docs | P1 | assigned |

## Roller

- **design-system**: Farvetokens, spacing-scale, z-index-lag, komponent-primitiver (V81-001, 002, 003, 017)
- **frontend**: CSS-lag, API-klient, navigation, state, formatering, storage, a11y, responsive (V81-004, 005, 006, 008, 009, 010, 011, 012, 014, 019)
- **backend**: Serverkontrakter, mock-data, validering, destructive actions (V81-007, 015, 016)
- **docs**: Copy-katalog, markør-klassificering, ownership-dokumentation (V81-013, 018, 020)

## Anbefalet rækkefølge

020 → 005 → 010 → 009 → 014 → 006 → 008 → 004 → 003 → 002 → 001 → 011 → 013 → 012 → 019 → 017 → 018

## Statistik

- Total items: 20
- Åbne (assigned): 17
- Lukkede (done): 3 (V81-007, V81-015, V81-016)
- design-system: 4 items
- frontend: 10 items
- backend: 3 items (alle done)
- docs: 3 items
