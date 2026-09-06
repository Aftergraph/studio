# Trust Gateway exact-head runtime seams
Source: Aftergraph/trust-gateway @ 515f8f744ff9b0a14df7398e38693fd3ac7ab667

- POST /v1/actions
- GET /v1/approvals
- POST /v1/approvals/:id/approve
- POST /v1/approvals/:id/deny
- GET /v1/audit?since=N
- GET /v1/audit/verify
- GET /v2/whoami -> strict {name, role, capabilities} projection
- GET /v2/need-you/now

Ownership: operator-facing runtime enforcement, approvals and audit. Tokens/secrets are never projected into V5 state.
