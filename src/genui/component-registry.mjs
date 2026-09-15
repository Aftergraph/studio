const INTERACTION_CLASSES=new Set(['read','draft','command','consequential']);
const SURFACES=new Set(['chat','work','space','artifact']);

export class AGGenUIError extends Error {
  constructor(code,message,details={}) {
    super(message);
    this.name='AGGenUIError';
    this.code=code;
    this.details=Object.freeze({...details});
  }
}

function fail(code,message,details){throw new AGGenUIError(code,message,details)}

function valueMatchesType(value,type){
  if(type==='array')return Array.isArray(value);
  if(type==='object')return value!==null&&typeof value==='object'&&!Array.isArray(value);
  if(type==='integer')return Number.isInteger(value);
  return typeof value===type;
}

export function createStrictSchema(shape={}) {
  const definition=Object.freeze({...shape});
  return Object.freeze({
    parse(input={}) {
      if(input===null||typeof input!=='object'||Array.isArray(input))fail('schema_invalid','Component props must be an object');
      const unknown=Object.keys(input).filter(key=>!(key in definition));
      if(unknown.length)fail('schema_invalid','Unknown component props',{unknown});
      const output={};
      for(const [key,rule] of Object.entries(definition)) {
        const value=input[key];
        if(value===undefined) {
          if(rule?.required)fail('schema_invalid',`Missing required prop: ${key}`,{prop:key});
          if('default' in (rule||{}))output[key]=rule.default;
          continue;
        }
        if(rule?.type&&!valueMatchesType(value,rule.type))fail('schema_invalid',`Invalid prop type: ${key}`,{prop:key,expected:rule.type});
        if(typeof rule?.validate==='function'&&!rule.validate(value))fail('schema_invalid',`Invalid prop value: ${key}`,{prop:key});
        output[key]=value;
      }
      return Object.freeze(output);
    },
  });
}

function normalizeComponent(component={}) {
  const id=String(component.id||'').trim();
  const version=String(component.version||'').trim();
  if(!id||!version)fail('invalid_component_contract','Component id and version are required');
  if(!component.schema||typeof component.schema.parse!=='function')fail('invalid_component_contract',`Schema required for ${id}`);
  if(typeof component.render!=='function')fail('invalid_component_contract',`Renderer required for ${id}`);
  if(!INTERACTION_CLASSES.has(component.interactionClass))fail('invalid_component_contract',`Unknown interaction class for ${id}`);
  const allowedContexts=[...(component.allowedContexts||[])];
  if(!allowedContexts.length||allowedContexts.some(surface=>!SURFACES.has(surface)))fail('invalid_component_contract',`Invalid allowed contexts for ${id}`);
  return Object.freeze({
    id,version,schema:component.schema,
    allowedContexts:Object.freeze(allowedContexts),
    interactionClass:component.interactionClass,
    requiredCapabilities:Object.freeze([...(component.requiredCapabilities||[])]),
    freshnessPolicy:component.freshnessPolicy||'allow-stale',
    authorityPolicy:component.authorityPolicy||'none',
    evidencePolicy:component.evidencePolicy||'none',
    render:component.render,
  });
}

export function createGenerativeRegistry({components=[]}={}) {
  const normalized=[];
  const byId=new Map();
  for(const candidate of components) {
    const component=normalizeComponent(candidate);
    if(byId.has(component.id))fail('duplicate_component',`Duplicate component: ${component.id}`);
    byId.set(component.id,component);
    normalized.push(component);
  }
  const frozen=Object.freeze(normalized);
  return Object.freeze({
    components:frozen,
    size:frozen.length,
    get(id){return byId.get(String(id))||null},
    has(id){return byId.has(String(id))},
  });
}

function stableInstanceId(node,context){
  return String(node.instanceId||`${node.componentId}:${context?.contextId||'context'}`);
}
export function validateGeneratedNode({registry,node={},context={}}={}) {
  if(!registry||typeof registry.get!=='function')fail('registry_required','Generative registry is required');
  const component=registry.get(node.componentId);
  if(!component)fail('unknown_component',`Unknown component: ${String(node.componentId||'')}`);
  if(String(node.version||'')!==component.version)fail('component_version_mismatch',`Unsupported component version: ${String(node.version||'')}`,{expected:component.version});
  const surface=String(context.surface||'');
  if(!component.allowedContexts.includes(surface))fail('context_not_allowed',`${component.id} is not allowed in ${surface||'this context'}`);
  if(node.interactionClass!==undefined&&node.interactionClass!==component.interactionClass)fail('interaction_class_override','Generated payload cannot override interaction class');
  const props=component.schema.parse(node.props||{});
  return Object.freeze({
    component,props,
    instanceId:stableInstanceId(node,context),
    contextId:String(context.contextId||''),
    surface,
  });
}

export function renderGeneratedNode({registry,node={},context={}}={}) {
  const validated=validateGeneratedNode({registry,node,context});
  const freshness=String(context.freshness||'unknown');
  const blocked=validated.component.freshnessPolicy==='current-required'&&freshness!=='current';
  let html='';
  try{html=String(validated.component.render(validated.props,{context,blocked,instanceId:validated.instanceId})??'')}
  catch(error){fail('render_failed',`Registered renderer failed for ${validated.component.id}`,{cause:error?.message||String(error)})}
  return Object.freeze({
    ok:true,
    componentId:validated.component.id,
    componentVersion:validated.component.version,
    instanceId:validated.instanceId,
    interactionClass:validated.component.interactionClass,
    blocked,
    blockReason:blocked?'freshness_required':null,
    html,
  });
}
