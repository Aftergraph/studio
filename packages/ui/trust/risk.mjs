import { AGIcon, esc, attr } from '../shared.mjs';

export function AGRisk({level='low',label=''}){const safe=String(level||'low').toLowerCase();return `<span class="ag-risk" data-ag-component="risk" data-risk="${attr(safe)}">${esc(label||safe)}</span>`;}
