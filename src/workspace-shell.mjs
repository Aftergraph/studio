import { DOMAINS } from './domain.mjs';

// Canonical human-facing workspace modes. Desktop can expose all three;
// mobile intentionally keeps only Chat + Work permanent and makes Space contextual.
export const PRIMARY_MODES=Object.freeze([
  {id:'chat',label:'Chat',domain:'chat',route:'/chat'},
  {id:'work',label:'Work',domain:'work',route:'/work'},
  {id:'space',label:'Space',domain:'work',route:'/space'},
]);

export const MOBILE_PRIMARY_MODES=Object.freeze(PRIMARY_MODES.filter(item=>item.id!=='space'));

export const SIDEBAR_DESTINATIONS=Object.freeze([
  {id:'space',label:'Space',domain:'work',route:'/space',kind:'mode'},
  {id:'projects',label:'Projects',domain:'work',route:'/projects',kind:'surface'},
  {id:'billing',label:'Billing',domain:'work',route:'/billing',kind:'surface'},
  {id:'plugins',label:'Plugins',domain:'connect',route:'/plugins',kind:'surface'},
  {id:'remote',label:'Remote',domain:'connect',route:'/remote',kind:'surface'},
  {id:'settings',label:'Settings',domain:'system',route:'/settings',kind:'surface'},
]);

export const SIDEBAR_UTILITIES=Object.freeze([
  {id:'artifacts',label:'Artifacts',domain:'output'},
]);

export const PRIMARY_NAV=PRIMARY_MODES;
export const WORKSPACE_NAV=SIDEBAR_UTILITIES;

const NAV_TO_DOMAIN=new Map([
  ...PRIMARY_MODES,
  ...SIDEBAR_DESTINATIONS,
  ...SIDEBAR_UTILITIES,
].map(item=>[item.id,item.domain]));

export function canonicalDomainForNav(id){
  return NAV_TO_DOMAIN.get(String(id||'').toLowerCase())||null;
}

export function commandDomainEntries(){
  return DOMAINS.map(domain=>({
    id:`domain:${domain.id}`,
    title:domain.label,
    domain:domain.id,
    description:domain.description,
  }));
}

export function deriveWorkspaceLayout({
  device='desktop',
  domain='chat',
  artifactOpen=false,
  inspectorOpen=false,
  destructiveApproval=false,
}={}){
  const mobile=device==='mobile';
  if(destructiveApproval){
    return {
      domain,
      mobileModes:MOBILE_PRIMARY_MODES,
      primaryDensity:mobile?'compact-conversation':'conversation',
      artifactPresentation:artifactOpen?'background':'hidden',
      inspectorPresentation:'hidden',
      controlPresentation:'focus',
    };
  }
  return {
    domain,
    mobileModes:MOBILE_PRIMARY_MODES,
    primaryDensity:mobile?'compact-conversation':'conversation',
    artifactPresentation:artifactOpen?(mobile?'fullscreen':'split'):'hidden',
    inspectorPresentation:inspectorOpen?(mobile?'sheet':'drawer'):'hidden',
    controlPresentation:'inline',
  };
}
