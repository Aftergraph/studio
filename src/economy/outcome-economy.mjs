// V7.4 Outcome Economy — attributable cost ledger and settlement projections.
// ponytail: integer cents + native Map gives idempotency without a new store.
// This module prepares financial provenance; it never moves money or invoices.

const MAX = Number.MAX_SAFE_INTEGER;
const VALID_KINDS = Object.freeze(['model', 'compute', 'agent', 'tool', 'provider', 'other']);

function cents(value, label = 'amountCents') {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${label} must be a finite number`);
  if (!Number.isInteger(value)) throw new TypeError(`${label} must be an integer`);
  if (value < 0) throw new RangeError(`${label} cannot be negative`);
  if (value > MAX) throw new RangeError(`${label} exceeds safe integer range`);
  return value;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function clone(value) { return structuredClone(value); }

export class CostLedger {
  #entries = new Map();

  constructor({ id, currency = 'EUR' }) {
    if (!id) throw new TypeError('CostLedger requires id');
    if (!currency) throw new TypeError('CostLedger requires currency');
    this.id = String(id);
    this.currency = String(currency).toUpperCase();
  }

  record({ id, missionId, kind, amountCents, evidenceRef = null, source = null }) {
    if (!id) throw new TypeError('cost entry requires id');
    if (!missionId) throw new TypeError('cost entry requires missionId');
    if (!VALID_KINDS.includes(kind)) throw new TypeError(`unknown cost kind: ${kind}`);
    const amount = cents(amountCents);
    const entry = freeze({ id: String(id), missionId: String(missionId), kind, amountCents: amount, evidenceRef, source });
    const previous = this.#entries.get(entry.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(entry)) throw new Error(`duplicate cost id with changed payload: ${entry.id}`);
      return previous;
    }
    this.#entries.set(entry.id, entry);
    return entry;
  }

  get entries() { return Object.freeze([...this.#entries.values()]); }

  totalFor(missionId) {
    return this.entries.filter(entry => entry.missionId === missionId).reduce((sum, entry) => sum + entry.amountCents, 0);
  }
}

export function settleOutcomeEconomy({ missionId, ledger, allocatedCents, evidenceRefs = [], verdict, humanApprovedOverrun = false }) {
  if (!missionId) throw new TypeError('settlement requires missionId');
  if (!(ledger instanceof CostLedger)) throw new TypeError('settlement requires CostLedger');
  const allocated = cents(allocatedCents, 'allocatedCents');
  if (!['success', 'partial', 'failed'].includes(verdict)) throw new TypeError('settlement requires valid verdict');
  if ((verdict === 'success' || verdict === 'partial') && (!Array.isArray(evidenceRefs) || evidenceRefs.length === 0)) {
    throw new Error('verified outcome settlement requires evidence');
  }
  const actual = ledger.totalFor(missionId);
  const withinBudget = actual <= allocated;
  if (!withinBudget && !humanApprovedOverrun) throw new Error('budget exceeded: human approval required for settlement');
  return Object.freeze({
    missionId: String(missionId), currency: ledger.currency, allocatedCents: allocated,
    actualCents: actual, varianceCents: allocated - actual, withinBudget,
    verdict, evidenceRefs: Object.freeze(evidenceRefs.map(String)), authority: 'none',
  });
}

export function reconcileEconomy({ ledger, receipts = [] }) {
  if (!(ledger instanceof CostLedger)) throw new TypeError('reconciliation requires CostLedger');
  if (!Array.isArray(receipts)) throw new TypeError('receipts must be an array');
  const byMission = new Map();
  for (const receipt of receipts) {
    if (!receipt?.missionId) throw new TypeError('receipt requires missionId');
    const amount = cents(receipt.actualCents, 'receipt actualCents');
    byMission.set(String(receipt.missionId), (byMission.get(String(receipt.missionId)) || 0) + amount);
  }
  const missionIds = new Set([...ledger.entries.map(entry => entry.missionId), ...byMission.keys()]);
  const mismatches = [...missionIds].map(missionId => {
    const ledgerCents = ledger.totalFor(missionId);
    const receiptCents = byMission.get(missionId) || 0;
    return { missionId, ledgerCents, receiptCents, deltaCents: ledgerCents - receiptCents };
  }).filter(row => row.deltaCents !== 0);
  return Object.freeze({ currency: ledger.currency, mismatches: Object.freeze(mismatches.map(row => Object.freeze(row))), authority: 'none' });
}
