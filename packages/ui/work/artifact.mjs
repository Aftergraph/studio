import { AGIcon, esc, attr } from '../shared.mjs';
import { AGTabs } from '../primitives/menu.mjs';

export function AGArtifact({id,title,state='draft',content='',verified=false}) {
  return `<article id="${attr(id)}" class="ag-artifact" data-ag-component="artifact" data-state="${attr(state)}" data-verified="${verified?'true':'false'}"><header>${AGIcon('artifact',{size:18})}<div><strong>${esc(title)}</strong><small>${esc(state)}${verified?' · verified':''}</small></div></header><div class="ag-artifact-body">${content}</div></article>`;
}

export function AGArtifactToolbar({active='preview'}) {
  return AGTabs({items:[{id:'preview',label:'Preview'},{id:'versions',label:'Versions'},{id:'details',label:'Details'}],active});
}

export function AGArtifactRow({artifact}) {
  if(!artifact) return '';
  return `<button type="button" class="ag-artifact-row" data-ag-component="artifact-row" data-state="${attr(artifact.state||'draft')}" data-verified="${artifact.verified?'true':'false'}" data-artifact="${attr(artifact.id)}"><span>${AGIcon('artifact',{size:16})}</span><span><strong>${esc(artifact.title)}</strong><small>${esc(artifact.kind||'Artifact')} · ${esc(artifact.state||'draft')}</small></span><span><em>${esc(artifact.updated||'')}</em>${artifact.verified?`<small>${AGIcon('check',{size:11})} verified</small>`:''}</span>${AGIcon('arrow',{size:12})}</button>`;
}
