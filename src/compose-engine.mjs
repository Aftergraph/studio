const DOMAIN_DEFAULT_SURFACE = Object.freeze({
  now:'attention-feed', chat:'conversation', work:'mission-detail', agents:'agent-roster',
  brain:'context-inspector', output:'artifact-library', control:'control-center', connect:'capability-hub', system:'system-status',
});

const ACTION_CAPABILITY = Object.freeze({
  now:null,
  chat:'chat.send',
  work:'work.execute',
  agents:'agent.delegate',
  brain:'memory.write',
  output:'artifact.publish',
  control:'approval.decide',
  connect:'connector.manage',
  system:'system.admin',
});

function hasCapability(capabilities, required) {
  if (!required) return true;
  return capabilities.includes('*') || capabilities.includes(required);
}

export function composePlan(input = {}) {
  const domain = String(input.domain || 'now').toLowerCase();
  const intent = String(input.intent || 'inspect').toLowerCase();
  const risk = String(input.risk || 'low').toLowerCase();
  const approvalState = String(input.approvalState || 'none').toLowerCase();
  const device = String(input.device || 'desktop').toLowerCase();
  const capabilities = Array.isArray(input.capabilities) ? input.capabilities : [];
  const surfaces = [];
  const omitted = [];
  const destructive = risk === 'destructive' || risk === 'critical';
  let dimBackground = false;

  if (destructive) {
    surfaces.push({ kind:'approval-gate', priority:0, density:'detail', reason:'risk' });
    dimBackground = true;
    omitted.push({ kind:'composer-action', reason:'risk' });
  }

  if (approvalState === 'awaiting' || approvalState === 'needs-approval') {
    surfaces.push({ kind:'needs-you', priority:1, density:'summary', reason:'approval' });
  }

  const primary = DOMAIN_DEFAULT_SURFACE[domain] || 'attention-feed';
  surfaces.push({ kind:primary, priority:surfaces.length, density:device === 'mobile' ? 'summary' : 'detail', reason:'domain' });

  const required = ACTION_CAPABILITY[domain];
  if (!destructive && (intent === 'execute' || intent === 'command' || intent === 'delegate')) {
    if (hasCapability(capabilities, required)) {
      surfaces.push({ kind:'action-bar', priority:surfaces.length, density:'compact', reason:'intent' });
    } else {
      omitted.push({ kind:'action-bar', reason:'capability', required });
    }
  }

  if (intent === 'unknown') {
    surfaces.push({ kind:'fallback-feed', priority:surfaces.length, density:'summary', reason:'intent' });
  }

  return {
    domain,
    intent,
    risk,
    approvalState,
    device,
    density: device === 'mobile' ? 'summary' : 'detail',
    dimBackground,
    surfaces,
    omitted,
  };
}
