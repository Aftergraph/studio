import { AGIcon, esc, attr } from '../shared.mjs';

export function AGOutcomeReceipt({title='Verified outcome',detail='',evidenceCount=0,action='open-artifact'}) {
  return `<section class="ag-outcome-receipt outcome-settlement" data-ag-component="outcome-receipt" role="status"><span class="ag-outcome-seal">${AGIcon('check',{size:16})}<i></i></span><span><small>Outcome settled</small><strong>${esc(title)}</strong>${detail?`<p>${esc(detail)}</p>`:''}<em>${Number(evidenceCount)||0} evidence records sealed</em></span><button type="button" data-action="${attr(action)}">Inspect ${AGIcon('arrow',{size:13})}</button></section>`;
}
