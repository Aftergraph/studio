# Aftergraph V5 upstream materialization

This directory pins the exact GitHub default-branch HEADs used to design and test the V5 polyrepo integration.

A normal `git clone` was attempted first, but the execution container could not resolve `github.com`. The connected GitHub integration remained available, so exact current HEADs, canonical contracts and the relevant runtime source seams were reviewed through that authenticated connection and materialized here with provenance.

This is intentionally **not described as a full Git clone**. The V5 integration itself talks to the real service APIs through first-party adapters. When deployed beside real clones/services, configure their URLs/tokens with `upstreams.env.example`.

Runtime ownership is preserved:
- Trust Gateway: runtime enforcement, approvals, audit
- WORKS: durable execution, journal, handoff, evidence, Company Brain
- AIE: normative authority / A2A transport
- Work Intelligence V2: detection and proposal only
- Governance: canonical cross-repo contracts
- ISR: human-experience research reference only

`SOURCE-MATERIALIZATION.json` is the machine-readable boundary: entries marked `exact-contract` are materialized contract documents from the pinned reviewed HEAD; `reviewed-interface-notes` are derived notes and are not represented as byte-identical repository source.

Additional private repositories tracked by governance but not independently readable in this session are listed as `tracked_but_not_materialized` rather than being inferred from stale metadata.
