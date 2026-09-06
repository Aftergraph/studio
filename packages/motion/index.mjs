import { MOTION_TOKENS } from '../tokens/index.mjs';

const SEMANTICS = Object.freeze({
  'control.press':{ class:'micro', duration:120, easing:'cubic-bezier(.2,.8,.2,1)' },
  'state.change':{ class:'state', duration:210, easing:'cubic-bezier(.2,.7,.2,1)' },
  'trajectory.advance':{ class:'state', duration:240, easing:'cubic-bezier(.2,.7,.2,1)' },
  'surface.expand':{ class:'surface', duration:340, easing:'cubic-bezier(.16,1,.3,1)' },
  'surface.collapse':{ class:'surface', duration:300, easing:'cubic-bezier(.16,1,.3,1)' },
  'attention.focus':{ class:'surface', duration:360, easing:'cubic-bezier(.16,1,.3,1)' },
  'outcome.settle':{ class:'surface', duration:420, easing:'cubic-bezier(.16,1,.3,1)' },
  'ambient.active':{ class:'ambient', duration:4200, easing:'linear' },
});

export function prefersReducedMotion(win=globalThis.window) {
  try { return Boolean(win?.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches); } catch { return false; }
}

export function motionFor(name,{reduced=prefersReducedMotion()}={}) {
  const base=SEMANTICS[name] || SEMANTICS['state.change'];
  return { ...base, duration:reduced?0:base.duration };
}

export function transitionDescriptor(layoutId,presentation,{reduced=false}={}) {
  const semantic=presentation==='hidden'?'surface.collapse':'surface.expand';
  return { layoutId, presentation, semantic, ...motionFor(semantic,{reduced}) };
}

// Compatibility hook retained for hosts that previously prewarmed an optional
// motion adapter. V5.2 deliberately has no network-backed animation runtime:
// correctness and presentation both use local platform primitives.
export async function loadMotion() {
  return null;
}

export function animateElement(element,keyframes,semantic='state.change',{reduced=prefersReducedMotion()}={}) {
  if (!element) return null;
  const cfg=motionFor(semantic,{reduced});
  if (!element.animate || cfg.duration===0) {
    const last=Array.isArray(keyframes)?keyframes.at(-1):keyframes;
    if (last && typeof last==='object') Object.assign(element.style,last);
    return null;
  }
  return element.animate(keyframes,{duration:cfg.duration,easing:cfg.easing,fill:'both'});
}

export function morphSurface(element,{from={opacity:0,transform:'translateY(8px) scale(.985)'},to={opacity:1,transform:'none'},semantic='surface.expand'}={}) {
  const cfg=motionFor(semantic);
  if (!element || cfg.duration===0) return null;
  return animateElement(element,[from,to],semantic);
}

export function ambientAllowed({active=true,reduced=prefersReducedMotion(),documentHidden=globalThis.document?.hidden}={}) {
  return Boolean(active && !reduced && !documentHidden);
}

export { MOTION_TOKENS };
