# Screenshot Evidence Standard

Product screenshots are evidence-bearing captures, never fabricated UI.

Each committed screenshot requires a sibling `<name>.capture.json` containing:

```json
{
  "schema_version": 1,
  "repo": "Aftergraph/example",
  "commit": "40-character git SHA",
  "captured_at": "RFC 3339 timestamp",
  "route": "/",
  "viewport": { "width": 1440, "height": 900 },
  "theme": "dark",
  "environment": "production",
  "product_version": "unknown",
  "classification": "live-runtime"
}
```

Allowed classifications: `live-runtime`, `local-exact-head`, `controlled-simulation`, `prototype-preview`. Preview captures must visibly say PREVIEW. The validator rejects missing SHAs, invalid timestamps, and screenshots narrower than 1200 px when marked for Marketplace use.

Freshness is a comparison, not a guess: a consumer pipeline should mark `STALE_SCREENSHOT` when UI-relevant files changed after the recorded commit.

