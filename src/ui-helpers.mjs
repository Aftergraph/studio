export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function attentionCount(state) {
  const linkedApprovalIds = new Set(state.needsYou.filter(n => n.objectType === 'approval').map(n => n.objectId));
  const pendingUnlinked = state.approvals.filter(a => a.state === 'pending' && !linkedApprovalIds.has(a.id)).length;
  return state.needsYou.length + pendingUnlinked;
}

export function missionStatusLabel(mission) {
  if (mission.verified || mission.state === 'verified') return 'Verified';
  if (mission.state === 'completed_unverified') return 'Completed · unverified';
  return String(mission.state || 'unknown').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function compactMoney(value, currency='€') {
  return `${currency}${Number(value || 0).toFixed(2)}`;
}

export function progressLabel(value) {
  return `${Math.max(0, Math.min(100, Number(value || 0)))}%`;
}
