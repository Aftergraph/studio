import { AGGenUIError, validateGeneratedNode } from './component-registry.mjs';
import { normalizeGeneratedCommand } from '../../packages/interaction/index.mjs';
import { assertActorCapability } from '../action-guard.mjs';

const TRANSPORT_KEYS=/^(?:endpoint|url|href|method|headers|authorization)$/i;

function fail(code,message,details={}){throw new AGGenUIError(code,message,details)}
function unique(values){return [...new Set(values.filter(Boolean).map(String))]}
function safeValues(values={}){
  if(values===null||typeof values!=='object'||Array.isArray(values))fail('generated_interaction_values_invalid','Generated interaction values must be an object');
  const unknown=Object.keys(values).filter(key=>TRANSPORT_KEYS.test(key));
  if(unknown.length)fail('generated_interaction_values_invalid','Generated interaction values cannot carry transport instructions',{unknown});
  return Object.freeze({...values});
}
function createdAt(now){
  const value=typeof now==='function'?now():new Date();
  const date=value instanceof Date?value:new Date(value);
  if(Number.isNaN(date.getTime()))fail('generated_interaction_time_invalid','Generated interaction timestamp invalid');
  return date.toISOString();
}

export function createGeneratedInteractionEnvelope({registry,actionCatalog,node={},context={},actorId,values={},now}={}){
  const validated=validateGeneratedNode({registry,node,context});
  const actionId=String(validated.props.action||'').trim();
  const actionSpec=actionCatalog?.get?.(actionId)||null;
  if(!actionSpec)fail('unknown_generated_action',`Unknown generated action: ${actionId||'(missing)'}`);
  if(actionSpec.interactionClass!==validated.component.interactionClass)fail('generated_action_class_mismatch','Generated action interaction class conflicts with component contract');
  const targetRef={type:String(validated.props.targetType||'mission'),id:String(validated.props.targetId||'')};
  if(!actionSpec.targetTypes.includes(targetRef.type))fail('generated_action_target_invalid',`Generated action cannot target ${targetRef.type}`);
  const command=normalizeGeneratedCommand({action:actionId,targetRefs:[targetRef],values:safeValues(values)});
  const requiredCapabilities=unique([...validated.component.requiredCapabilities,...actionSpec.requiredCapabilities]);
  const interactionId=`${validated.instanceId}:${command.action}`;
  return Object.freeze({
    interactionId,
    componentId:validated.component.id,
    componentVersion:validated.component.version,
    instanceId:validated.instanceId,
    contextId:validated.contextId,
    actorId:String(actorId||''),
    action:command.action,
    targetRefs:command.targetRefs,
    values:command.values,
    interactionClass:validated.component.interactionClass,
    requiredCapabilities:Object.freeze(requiredCapabilities),
    freshnessPolicy:validated.component.freshnessPolicy,
    authorityPolicy:actionSpec.authorityPolicy||validated.component.authorityPolicy,
    risk:actionSpec.risk,
    createdAt:createdAt(now),
    executed:false,
  });
}

function blocked(envelope,reason,details={}){
  return Object.freeze({status:'blocked',reason,envelope,executionAllowed:false,...details});
}

export function prepareGeneratedInteraction({registry,actionCatalog,node={},context={},actorState,actorId,values={},resolveAuthority,now}={}){
  const envelope=createGeneratedInteractionEnvelope({registry,actionCatalog,node,context,actorId,values,now});
  if(envelope.freshnessPolicy==='current-required'&&String(context.freshness||'unknown')!=='current') return blocked(envelope,'freshness_required');
  const missingCapabilities=[];
  for(const capability of envelope.requiredCapabilities){
    try{assertActorCapability({state:actorState,actor:actorId,capability})}catch{missingCapabilities.push(capability)}
  }
  if(missingCapabilities.length) return blocked(envelope,'capability_required',{missingCapabilities:Object.freeze(missingCapabilities)});
  if(envelope.authorityPolicy==='none') return Object.freeze({status:'prepared',envelope,authority:Object.freeze({status:'not-required'}),executionAllowed:false});
  if(typeof resolveAuthority!=='function') return Object.freeze({status:'prepared',envelope,authority:Object.freeze({status:'pending'}),executionAllowed:false});
  const authority=resolveAuthority(Object.freeze({
    kind:'generated-authority-request',
    interactionId:envelope.interactionId,
    actorId:envelope.actorId,
    action:envelope.action,
    targetRefs:envelope.targetRefs,
    requiredCapabilities:envelope.requiredCapabilities,
    interactionClass:envelope.interactionClass,
    contextId:envelope.contextId,
    risk:envelope.risk,
  }));
  if(!authority||authority.status!=='resolved') {
    const pendingAuthority=Object.freeze({status:'pending',owner:String(authority?.owner||''),operation:String(authority?.operation||envelope.action),requiresApproval:Boolean(authority?.requiresApproval)});
    return Object.freeze({status:'prepared',envelope,authority:pendingAuthority,executionAllowed:false});
  }
  const normalizedAuthority=Object.freeze({
    status:'resolved',
    owner:String(authority.owner||''),
    operation:String(authority.operation||envelope.action),
    requiresApproval:Boolean(authority.requiresApproval),
  });
  if(!normalizedAuthority.owner) return blocked(envelope,'authority_unresolved',{authority:normalizedAuthority});
  return Object.freeze({status:'prepared',envelope,authority:normalizedAuthority,executionAllowed:false});
}
