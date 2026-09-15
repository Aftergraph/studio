import { nextSemanticZoom } from '../spatial/index.mjs';

const SEMANTIC_ACTION=/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/i;

export function normalizeGeneratedCommand({ action, targetRefs=[], values={} }={}) {
  const semanticAction=String(action||'').trim();
  if(!semanticAction||semanticAction.length>96||!SEMANTIC_ACTION.test(semanticAction)) throw new TypeError('semantic action id required');
  if(!Array.isArray(targetRefs)||targetRefs.length>8) throw new TypeError('generated command targetRefs invalid');
  const refs=targetRefs.map(ref=>{
    const type=String(ref?.type||'').trim();const id=String(ref?.id||'').trim();
    if(!type||!id||type.length>48||id.length>240) throw new TypeError('generated command target ref invalid');
    return Object.freeze({type,id});
  });
  if(values===null||typeof values!=='object'||Array.isArray(values)) throw new TypeError('generated command values invalid');
  return Object.freeze({kind:'generated-command',action:semanticAction,targetRefs:Object.freeze(refs),values:Object.freeze({...values})});
}

export function resolveInteraction({ command, surfaceId=null, regionId=null, level='mission', objectId=null }={}) {
  switch (command) {
    case 'focus-surface': return { type:'surface.focus', surfaceId };
    case 'close-surface': return { type:'surface.close', surfaceId };
    case 'move-surface': return { type:'surface.move', surfaceId, regionId };
    case 'zoom-in': return { type:'zoom.set', level:nextSemanticZoom(level,1), objectId };
    case 'zoom-out': return { type:'zoom.set', level:nextSemanticZoom(level,-1), objectId };
    case 'focus-space': return { type:'space.mode', mode:'focus' };
    case 'overview-space': return { type:'space.mode', mode:'overview' };
    default: return null;
  }
}
