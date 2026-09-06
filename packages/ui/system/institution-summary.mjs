import { esc } from '../shared.mjs';

export function AGInstitutionSummary({ projection = null } = {}) {
  const organization = projection?.organization;
  if (!organization) return `<section class="ag-institution-summary" data-ag-component="institution-summary"><small>INSTITUTIONAL GRAPH</small><strong>No institution mounted</strong><p>Organization scope and policy state will appear here when an institutional owner is connected.</p><span>Authority: none</span></section>`;
  return `<section class="ag-institution-summary" data-ag-component="institution-summary"><small>INSTITUTIONAL GRAPH</small><strong>${esc(organization.name)}</strong><p>${projection.memberships?.length||0} members · ${projection.policies?.length||0} policies</p><span>Authority: ${esc(projection.authority||'none')}</span></section>`;
}
