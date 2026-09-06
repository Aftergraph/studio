import { nextSemanticZoom } from '../spatial/index.mjs';

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
