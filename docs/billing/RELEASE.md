# Aftergraph Billing Public Pilot Release Gate

This checklist separates a green merge candidate from an actual public pilot deployment. Passing CI is necessary, but it does not authorize external delivery or production rollout by itself.

## Release candidate gate

Before merge/release candidate promotion:

- exact-head Billing tests pass;
- exact-head full Studio tests pass;
- monolithic release verification is 49/49;
- CodeQL and Studio CI are green on the same SHA;
- desktop and mobile Billing journeys pass from clean state;
- offline mode remains read-only and reconnect restores current state;
- `git diff --check` and secret scan pass;
- no unresolved blocking review thread remains.

## Public pilot deployment gate

Before exposing Billing to pilot users:

- production auth is enforced and a non-development auth secret is configured;
- demo fixtures are disabled;
- persistent state has an automated backup/restore procedure;
- the pilot tenant onboarding record is reviewed for legal name, address, registration identity, payment information and invoice sequence;
- delivery provider configuration is tested with a non-production recipient before real invoices are sent;
- delivery provider secrets are present only in the deployment secret store;
- PDF output is spot-checked with the real pilot company profile;
- Peppol/UBL export is enabled only for customers whose endpoint preflight and external validation pass;
- monitoring can distinguish provider 4xx/5xx, receipt validation failure and application errors;
- rollback has been rehearsed before the first public pilot invoice.

## Tenant onboarding

Rendetalje is the first pilot tenant, not a hard-coded product default. A tenant onboarding pass must establish:

1. business identity and registration scheme;
2. postal/contact/payment information;
3. invoice sequence starting point;
4. default service label and tax context;
5. optional Peppol/Nemhandel endpoint identity;
6. permitted operators with `billing.manage` capability.

A new tenant should be able to supply those settings without changing Billing source code.

## Delivery provider contract

Production delivery is opt-in. The configured HTTPS provider must accept the versioned Billing delivery request and return a durable provider receipt. Missing configuration, timeout, HTTP failure or invalid receipt must leave the invoice issued and retryable, never falsely delivered.

## Rollback

Rollback means deployment rollback plus durable-state protection. Do not restore an older state file over newer issued invoices. Preserve the current Billing state, stop outbound delivery, roll back application code, verify read-only invoice visibility, then re-enable mutations only after compatibility is confirmed.

Merging the PR and deploying the public pilot are intentionally separate decisions.
