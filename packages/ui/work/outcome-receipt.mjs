import { AGIcon, esc, attr } from '../shared.mjs';

export function AGOutcomeReceipt({title='Verified outcome',detail='',evidenceCount=0,action='open-artifact',actualCents=null,allocatedCents=null,currency='EUR'}) {
  const economy=Number.isInteger(actualCents)&&Number.isInteger(allocatedCents)?`<em data-economy-status="settled">${esc(currency)} ${(actualCents/100).toFixed(2)} actual · ${(allocatedCents/100).toFixed(2)} allocated</em>`:'';
  return `<section class="ag-outcome-receipt outcome-settlement" data-ag-component="outcome-receipt" role="status"><span class="ag-outcome-seal">${AGIcon('check',{size:16})}<i></i></span><span><small>Outcome settled</small><strong>${esc(title)}</strong>${detail?`<p>${esc(detail)}</p>`:''}<em>${Number(evidenceCount)||0} evidence records sealed</em>${economy}</span><button type="button" data-action="${attr(action)}">Inspect ${AGIcon('arrow',{size:13})}</button></section>`;
}
