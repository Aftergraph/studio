const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
const attr = esc;
const clone = value => structuredClone(value);

export const semanticZoomLevels = Object.freeze(['mission','workstream','task','agent','action','evidence']);

export function createSpatialState({ id='space_primary', device='desktop' }={}) {
  return {
    id,
    version:1,
    mode:'balanced',
    device,
    focusedSurfaceId:null,
    zoom:{ level:'mission', objectId:null },
    regions:[
      { id:'primary', role:'primary', size:device==='mobile'?1:0.58, surfaces:[] },
      { id:'detail', role:'detail', size:device==='mobile'?1:0.42, surfaces:[] },
    ],
    updatedAt:null,
  };
}

function findSurface(space, surfaceId) {
  for (const region of space.regions) {
    const surface = region.surfaces.find(item => item.id === surfaceId);
    if (surface) return { region, surface };
  }
  return null;
}

export function reduceSpatialState(current, action={}) {
  const next = clone(current || createSpatialState());
  switch (action.type) {
    case 'surface.dock': {
      if (!action.surface?.id) return next;
      for (const region of next.regions) region.surfaces = region.surfaces.filter(item => item.id !== action.surface.id);
      const target = next.regions.find(region => region.id === action.regionId) || next.regions[0];
      target.surfaces.push({ ...clone(action.surface), presentation:action.presentation || 'dock' });
      next.focusedSurfaceId = action.focus === false ? next.focusedSurfaceId : action.surface.id;
      break;
    }
    case 'surface.close': {
      for (const region of next.regions) region.surfaces = region.surfaces.filter(item => item.id !== action.surfaceId);
      if (next.focusedSurfaceId === action.surfaceId) next.focusedSurfaceId = null;
      break;
    }
    case 'surface.focus': {
      if (findSurface(next, action.surfaceId)) next.focusedSurfaceId = action.surfaceId;
      break;
    }
    case 'surface.move': {
      const found = findSurface(next, action.surfaceId);
      const target = next.regions.find(region => region.id === action.regionId);
      if (found && target && found.region.id !== target.id) {
        found.region.surfaces = found.region.surfaces.filter(item => item.id !== action.surfaceId);
        target.surfaces.push(found.surface);
      }
      break;
    }
    case 'region.resize': {
      const primary = next.regions.find(region => region.id === 'primary');
      const detail = next.regions.find(region => region.id === 'detail');
      if (primary && detail) {
        const value = Math.max(0.34, Math.min(0.72, Number(action.primarySize) || 0.58));
        primary.size = value;
        detail.size = Number((1 - value).toFixed(2));
      }
      break;
    }
    case 'space.mode': {
      if (['balanced','focus','overview'].includes(action.mode)) next.mode = action.mode;
      break;
    }
    case 'zoom.set': {
      if (semanticZoomLevels.includes(action.level)) next.zoom = { level:action.level, objectId:action.objectId || null };
      break;
    }
  }
  next.updatedAt = action.at || next.updatedAt;
  return next;
}

export function nextSemanticZoom(level, direction=1) {
  const index = Math.max(0, semanticZoomLevels.indexOf(level));
  const next = Math.max(0, Math.min(semanticZoomLevels.length - 1, index + Math.sign(direction || 1)));
  return semanticZoomLevels[next];
}

export function AGSurface({ surface, focused=false, body='' }={}) {
  if (!surface) return '';
  return `<section class="ag-space-surface ${focused?'is-focused':''}" data-ag-component="space-surface" data-surface="${attr(surface.id)}" data-kind="${attr(surface.kind||'surface')}" tabindex="0"><header data-space-drag-handle="${attr(surface.id)}"><span><small>${esc(surface.kind||'Surface')}</small><strong>${esc(surface.title||surface.id)}</strong></span><span class="ag-space-surface-actions"><button type="button" data-space-action="focus" data-surface-id="${attr(surface.id)}" aria-label="Focus ${attr(surface.title||surface.id)}">Focus</button><button type="button" data-space-action="move" data-surface-id="${attr(surface.id)}" aria-label="Move ${attr(surface.title||surface.id)} to other region">Move</button><button type="button" data-space-action="close" data-surface-id="${attr(surface.id)}" aria-label="Close ${attr(surface.title||surface.id)}">×</button></span></header><div class="ag-space-surface-body" data-surface-slot="${attr(surface.id)}">${body}</div></section>`;
}


export function AGRegion({ region, focusedSurfaceId=null, renderSurfaceBody=null }={}) {
  if (!region) return '';
  const surfaces=Array.isArray(region.surfaces)?region.surfaces:[];
  return `<div class="ag-space-region" data-ag-component="space-region" data-region="${attr(region.id)}" data-role="${attr(region.role||'region')}" style="--region-size:${Number(region.size)||0.5}">${surfaces.map(surface => AGSurface({ surface, focused:focusedSurfaceId===surface.id, body:typeof renderSurfaceBody==='function'?renderSurfaceBody(surface):'' })).join('') || `<div class="ag-space-dropzone" data-space-dropzone="${attr(region.id)}"><span>${region.role==='primary'?'Work lives here':'Dock context here'}</span><small>Open an object or use ⌘K</small></div>`}</div>`;
}

export function AGDock({ items=[] }={}) {
  return `<nav class="ag-space-dock" data-ag-component="space-dock" aria-label="Add surface"><span>Add surface</span>${items.map(item=>`<button type="button" data-space-add="${attr(item.kind)}">${esc(item.label||item.kind)}</button>`).join('')}</nav>`;
}

export function AGSurfaceStack({ surfaces=[], activeId=null }={}) {
  return `<section class="ag-surface-stack" data-ag-component="surface-stack">${surfaces.map(surface=>`<button type="button" data-space-action="focus" data-surface-id="${attr(surface.id)}" aria-current="${surface.id===activeId?'true':'false'}">${esc(surface.title||surface.id)}</button>`).join('')}</section>`;
}

export function AGPeek({ surface }={}) {
  if(!surface)return '';
  return `<button type="button" class="ag-space-peek" data-ag-component="space-peek" data-space-action="focus" data-surface-id="${attr(surface.id)}"><small>${esc(surface.kind||'surface')}</small><strong>${esc(surface.title||surface.id)}</strong></button>`;
}

export function AGFocus({ surfaceId=null, title='Focused work', content='' }={}) {
  return `<section class="ag-space-focus" data-ag-component="space-focus" data-surface-id="${attr(surfaceId||'')}"><header><small>Focus</small><strong>${esc(title)}</strong></header>${content}</section>`;
}

export function AGContextLens({ level='mission', objectId=null, detail='' }={}) {
  return `<section class="ag-context-lens" data-ag-component="context-lens" data-level="${attr(level)}"><small>Context lens · ${esc(level)}</small><strong>${esc(objectId||'workspace')}</strong>${detail?`<p>${esc(detail)}</p>`:''}</section>`;
}

export function AGSpace({ space, renderSurfaceBody=null }={}) {
  if (!space) return '';
  return `<section class="ag-space" data-ag-component="space" data-mode="${attr(space.mode)}" data-zoom="${attr(space.zoom?.level||'mission')}">${space.regions.map(region => AGRegion({region,focusedSurfaceId:space.focusedSurfaceId,renderSurfaceBody})).join('')}</section>`;
}

export function AGSemanticZoom({ level='mission', objectId=null }={}) {
  const index = Math.max(0, semanticZoomLevels.indexOf(level));
  return `<nav class="ag-semantic-zoom" data-ag-component="semantic-zoom" aria-label="Semantic zoom">${semanticZoomLevels.map((item,i)=>`<button type="button" data-space-action="zoom" data-zoom-level="${item}" aria-current="${item===level?'step':'false'}" class="${item===level?'active':''}"><span>${i+1}</span>${esc(item)}</button>`).join('')}<output>${esc(objectId||'workspace')}</output><button type="button" data-space-action="zoom-out" ${index===0?'disabled':''} aria-label="Zoom out">−</button><button type="button" data-space-action="zoom-in" ${index===semanticZoomLevels.length-1?'disabled':''} aria-label="Zoom in">+</button></nav>`;
}
