const ACTION_ID=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/i;
const TARGET_TYPES=new Set(['mission','work','artifact','approval']);

function freezeSpec(spec={}){
  const id=String(spec.id||'').trim();
  if(!id||id.length>96||!ACTION_ID.test(id)) throw new TypeError('generated action id invalid');
  const interactionClass=String(spec.interactionClass||'command');
  if(!['draft','command','consequential'].includes(interactionClass)) throw new TypeError(`generated action interaction class invalid: ${id}`);
  const targetTypes=[...(spec.targetTypes||[])];
  if(!targetTypes.length||targetTypes.some(type=>!TARGET_TYPES.has(type))) throw new TypeError(`generated action target types invalid: ${id}`);
  return Object.freeze({
    id,interactionClass,
    requiredCapabilities:Object.freeze([...(spec.requiredCapabilities||[])]),
    targetTypes:Object.freeze(targetTypes),
    authorityPolicy:spec.authorityPolicy||'resolve',
    risk:spec.risk||'medium',
  });
}

export function createGeneratedActionCatalog({actions=[]}={}){
  const byId=new Map();
  for(const candidate of actions){const spec=freezeSpec(candidate);if(byId.has(spec.id))throw new Error(`duplicate generated action: ${spec.id}`);byId.set(spec.id,spec)}
  const entries=Object.freeze([...byId.values()]);
  return Object.freeze({actions:entries,size:entries.length,get:id=>byId.get(String(id))||null,has:id=>byId.has(String(id))});
}

export function createAftergraphGeneratedActionCatalog(){
  return createGeneratedActionCatalog({actions:[
    {id:'release.prepare',interactionClass:'command',requiredCapabilities:['work.execute'],targetTypes:['mission'],authorityPolicy:'resolve',risk:'medium'},
    {id:'mission.run',interactionClass:'command',requiredCapabilities:['work.execute'],targetTypes:['mission'],authorityPolicy:'resolve',risk:'medium'},
    {id:'mission.pause',interactionClass:'command',requiredCapabilities:['work.execute'],targetTypes:['mission'],authorityPolicy:'resolve',risk:'medium'},
    {id:'mission.resume',interactionClass:'command',requiredCapabilities:['work.execute'],targetTypes:['mission'],authorityPolicy:'resolve',risk:'medium'},
  ]});
}
