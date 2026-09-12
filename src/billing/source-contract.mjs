export const BILLING_SOURCE_SCHEMA = 'aftergraph.billing.source.v1';

export function buildBillingSourceEnvelope({ sourceId, revision, syncedAt, customers = [], visits = [] } = {}) {
  return {
    schema: BILLING_SOURCE_SCHEMA,
    source: { id: sourceId, revision, syncedAt },
    customers: structuredClone(customers),
    visits: structuredClone(visits),
  };
}
