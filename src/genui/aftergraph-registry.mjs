import { esc, attr } from '../../packages/ui/shared.mjs';
import { createGenerativeRegistry, createStrictSchema } from './component-registry.mjs';

const shortString=value=>typeof value==='string'&&value.length<=240;
const objectItems=value=>Array.isArray(value)&&value.length<=40&&value.every(item=>item&&typeof item==='object'&&!Array.isArray(item));

const workSchema=createStrictSchema({
  title:{type:'string',required:true,validate:shortString},
  state:{type:'string',required:true,validate:shortString},
  progress:{type:'number',required:true,validate:value=>value>=0&&value<=100},
  agent:{type:'string',required:true,validate:shortString},
  evidenceCount:{type:'number',required:true,validate:Number.isFinite},
});
const evidenceSchema=createStrictSchema({
  title:{type:'string',required:true,validate:shortString},
  items:{type:'array',required:true,validate:objectItems},
});
const metricSchema=createStrictSchema({
  title:{type:'string',required:true,validate:shortString},
  metrics:{type:'array',required:true,validate:objectItems},
});
const artifactSchema=createStrictSchema({
  title:{type:'string',required:true,validate:shortString},
  kind:{type:'string',required:true,validate:shortString},
  state:{type:'string',required:true,validate:shortString},
  verified:{type:'boolean',required:true},
  objectId:{type:'string',required:true,validate:shortString},
});
const actionSchema=createStrictSchema({
  title:{type:'string',required:true,validate:shortString},
  detail:{type:'string',required:true,validate:value=>typeof value==='string'&&value.length<=600},
  action:{type:'string',required:true,validate:value=>/^[a-z0-9][a-z0-9._-]{0,80}$/i.test(value)},
  targetType:{type:'string',default:'mission',validate:value=>['mission','work','artifact','approval'].includes(value)},
  targetId:{type:'string',required:true,validate:shortString},
});

function base(id,schema,{interactionClass='read',contexts=['chat','work','space'],freshnessPolicy='allow-stale',requiredCapabilities=[]}={}){
  return {id,version:'1.0.0',schema,allowedContexts:contexts,interactionClass,requiredCapabilities,freshnessPolicy,authorityPolicy:interactionClass==='read'?'none':'resolve',evidencePolicy:'inspectable'};
}

function renderWorkSummary(props){
  return `<section class="ag-genui-work" data-generated-component="WorkSummary"><header><span>${esc(props.state)}</span><strong>${esc(props.title)}</strong></header><div class="ag-genui-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${attr(props.progress)}"><i style="width:${attr(props.progress)}%"></i></div><footer><span>${esc(props.agent)}</span><span>${esc(props.evidenceCount)} evidence</span></footer></section>`;
}

function validEvidence(item){return typeof item.id==='string'&&typeof item.label==='string'&&typeof item.state==='string'}
function renderEvidenceList(props){
  const items=props.items.filter(validEvidence).map(item=>`<li data-object-ref="evidence:${attr(item.id)}"><span>${esc(item.state)}</span><strong>${esc(item.label)}</strong></li>`).join('');
  return `<section class="ag-genui-evidence" data-generated-component="EvidenceList"><header><strong>${esc(props.title)}</strong><small>${props.items.length}</small></header><ul>${items}</ul></section>`;
}

function validMetric(item){return typeof item.label==='string'&&['string','number'].includes(typeof item.value)}
function renderMetricTable(props){
  const rows=props.metrics.filter(validMetric).map(item=>`<div><span>${esc(item.label)}</span><strong>${esc(item.value)}</strong>${item.delta!==undefined?`<small>${esc(item.delta)}</small>`:''}</div>`).join('');
  return `<section class="ag-genui-metrics" data-generated-component="MetricTable"><header><strong>${esc(props.title)}</strong></header><div>${rows}</div></section>`;
}
function renderArtifactPreview(props){
  const verified=props.verified?'Verified':'Unverified';
  return `<button type="button" class="ag-genui-artifact" data-generated-component="ArtifactPreview" data-object-ref="artifact:${attr(props.objectId)}"><span><small>${esc(props.kind)} · ${esc(props.state)}</small><strong>${esc(props.title)}</strong></span><em>${verified}</em></button>`;
}

function renderActionProposal(props,{blocked=false,context={},instanceId=''}={}){
  const interaction=context?.interactionStates?.[instanceId]||null;
  const prepared=interaction?.status==='prepared';
  const interactionBlocked=interaction?.status==='blocked';
  const authorityPending=prepared&&interaction?.authority?.status==='pending';
  const disabled=blocked||prepared||interactionBlocked;
  const label=blocked?'Requires current state':interactionBlocked?'Blocked':authorityPending?'Prepared · Authority pending':prepared?'Prepared':'Prepare';
  return `<section class="ag-genui-action" data-generated-component="ActionProposal" data-interaction-state="${attr(interaction?.status||'idle')}"><div><small>Proposed action</small><strong>${esc(props.title)}</strong><p>${esc(props.detail)}</p></div><button type="button" data-generated-action="${attr(props.action)}" data-target-ref="${attr(`${props.targetType}:${props.targetId}`)}" ${disabled?'disabled aria-disabled="true"':''}>${esc(label)}</button></section>`;
}

export function createAftergraphGenerativeRegistry(){
  return createGenerativeRegistry({components:[
    {...base('WorkSummary',workSchema),render:renderWorkSummary},
    {...base('EvidenceList',evidenceSchema),render:renderEvidenceList},
    {...base('MetricTable',metricSchema),render:renderMetricTable},
    {...base('ArtifactPreview',artifactSchema,{contexts:['chat','work','space','artifact']}),render:renderArtifactPreview},
    {...base('ActionProposal',actionSchema,{interactionClass:'command',freshnessPolicy:'current-required',requiredCapabilities:['work.execute']}),render:renderActionProposal},
  ]});
}
