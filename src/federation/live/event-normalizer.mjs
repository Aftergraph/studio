import { createEventEnvelope } from './event-envelope.mjs';

// ponytail: table-driven normalization of heterogeneous engine events to canonical envelope
const NORMALIZERS = {
  'trust-gateway': raw => {
    const isRequested = raw.type === 'approval_requested' || raw.action === 'approval_requested';
    const id = raw.item?.approvalId || raw.approvalId || raw.id;
    return {
      type: isRequested ? 'approval.requested' : 'approval.decided',
      objectRef: `trust-gateway:approval:${id}`
    };
  },
  'works': raw => {
    const eventType = raw.event_type || raw.type || 'step_completed';
    const isStep = eventType.includes('step');
    const id = raw.work_id || raw.workId || raw.id;
    return {
      type: isStep ? 'work.step.completed' : 'work.event',
      objectRef: `works:work:${id}`
    };
  },
  'work-intelligence': raw => {
    const isObs = raw.kind === 'observation_detected' || raw.type === 'observation_detected';
    const id = raw.observation_id || raw.work_item_id || raw.id;
    return {
      type: isObs ? 'observation.ingested' : 'work_item.created',
      objectRef: `work-intelligence:observation:${id}`
    };
  },
  'aie': raw => {
    const isDelegation = raw.action === 'delegation_granted' || raw.type === 'delegation_granted';
    const id = raw.delegation_id || raw.task_id || raw.id;
    return {
      type: isDelegation ? 'delegation.granted' : 'task.updated',
      objectRef: `aie:delegation:${id}`
    };
  },
  'avc': raw => {
    const isIncident = raw.event === 'incident_raised' || raw.type === 'incident_raised';
    const id = raw.incident_id || raw.agent_id || raw.id;
    return {
      type: isIncident ? 'cell.incident.raised' : 'agent.assigned',
      objectRef: `avc:incident:${id}`
    };
  },
  'isr': raw => {
    const id = raw.claim_id || raw.id;
    return {
      type: 'claim.verified',
      objectRef: `isr:claim:${id}`,
      evidenceRef: raw.evidence_id ? `isr:evidence:${raw.evidence_id}` : null
    };
  },
  'skills-vault': raw => {
    const id = raw.skill_id || raw.id;
    return {
      type: 'skill.discovered',
      objectRef: `skills-vault:skill:${id}`
    };
  },
  'governance': raw => {
    const id = raw.contract_id || raw.id;
    return {
      type: 'contract.attested',
      objectRef: `governance:contract:${id}`
    };
  }
};

export function normalizeFederatedEvent({
  sourceIntegration,
  sourceRevision = 'pinned-head',
  sequence,
  rawEvent = {}
} = {}) {
  const normalizer = NORMALIZERS[sourceIntegration];
  const mapped = normalizer
    ? normalizer(rawEvent)
    : {
        type: rawEvent.type || 'generic.event',
        objectRef: rawEvent.id ? `${sourceIntegration}:object:${rawEvent.id}` : null
      };

  return createEventEnvelope({
    id: rawEvent.id || rawEvent.event_id || rawEvent.message_id,
    sourceIntegration,
    sourceRevision,
    type: mapped.type,
    sequence,
    objectRef: mapped.objectRef,
    evidenceRef: mapped.evidenceRef || null,
    payload: rawEvent
  });
}
