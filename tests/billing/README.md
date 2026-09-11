# Billing production audit tests

These tests protect the installable Billing app against production-only regressions that unit/domain tests do not catch: service-worker shell completeness, CSP-safe navigation, authenticated session propagation, and identity-scoped offline cache behavior.
