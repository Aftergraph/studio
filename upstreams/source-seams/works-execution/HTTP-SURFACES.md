# WORKS exact-head runtime seams
Source: Aftergraph/works-execution @ 3ea1a80494c38f3e422339db6efbf5a7935a48be

- POST /v1/works
- GET /v1/works/:id
- GET /v1/works/:id/events?after=N&limit=M (journal) or SSE without query
- GET /v1/works/:id/handoff
- POST /v1/works/:id/suspend
- POST /v1/works/:id/resume
- POST /v1/works/:id/cancel
- GET /v1/works/:id/evidence
- GET/POST /v1/brain/objects

Ownership: durable execution, journal, handoff, evidence and Company Brain.
