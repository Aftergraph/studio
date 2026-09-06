# AIE HTTP+JSON exact-head seams
Source: Aftergraph/aie @ 3432834afd80e60009f1252a1801f21feb551b9b

Implemented operations:
- POST /message:send
- POST /message:stream (SSE)
- GET /tasks
- GET /tasks/:id
- POST /tasks/:id:cancel
- POST /tasks/:id:subscribe (SSE)

Optional tenant prefix is supported. message.messageId is mandatory for send/stream. mTLS/SPIFFE is the preferred trusted identity path. V5 does not invent an AIE bearer-token contract.
