import { domainForObject } from '../domain.mjs';
export function applyExplicitNavigation(state={},route={}){
  const next={...state};
  if(route.kind==='mode'){next.primaryMode=route.mode;next.activeDomain=route.domain;return next}
  if(route.kind==='domain'){next.activeDomain=route.domain;if(['chat','work'].includes(route.domain))next.primaryMode=route.domain;return next}
  if(route.kind==='object'){next.activeDomain=route.domain||domainForObject(route.type);return next}
  return next;
}
