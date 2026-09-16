# WORKS exact-head runtime seams
Source: Aftergraph/works-execution @ f69e5182f9d3d7e74817ec8ec2cee52ba2f9c62d

- POST /v1/works
- GET /v1/works/:id
- GET /v1/works/:id/events?after=N&limit=M (journal) or SSE without query
- GET /v1/works/:id/handoff
- POST /v1/works/:id/suspend
- POST /v1/works/:id/resume
- POST /v1/works/:id/cancel
- GET /v1/works/:id/evidence — terminal evidence bundle plus additive `outcome_verification` (`pending|passed|failed`, verifier/evidence/timestamp provenance on terminal verdicts)
- GET/POST /v1/brain/objects

Ownership: durable execution, journal, handoff, evidence and Company Brain.
