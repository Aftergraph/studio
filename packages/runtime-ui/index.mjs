export function attentionGravity({risk='low',approvalPending=false,takeover=false,attention='normal'}={}) {
  if ((risk==='destructive'||risk==='critical') && approvalPending) return {mode:'approval-focus',weight:100,reason:'risk'};
  if (takeover) return {mode:'takeover',weight:80,reason:'ownership'};
  if (attention==='needs-you') return {mode:'attention',weight:60,reason:'attention'};
  return {mode:'flow',weight:10,reason:'work'};
}

export function composeLivingLayout({device='desktop',artifactOpen=false,inspectorOpen=false,risk='low',approvalPending=false,takeover=false,attention='normal'}={}) {
  const mobile=device==='mobile';
  const gravity=attentionGravity({risk,approvalPending,takeover,attention});
  if (gravity.mode==='approval-focus') {
    return {
      gravity,
      workspace:{mode:'background',density:mobile?'compact':'comfortable'},
      artifact:{presentation:artifactOpen?'background':'hidden'},
      inspector:{presentation:'hidden'},
      control:{presentation:'focus'},
      ambient:{mode:'attention'},
    };
  }
  return {
    gravity,
    workspace:{mode:takeover?'takeover':'flow',density:mobile?'compact':'comfortable'},
    artifact:{presentation:artifactOpen?(mobile?'fullscreen':'split'):'hidden'},
    inspector:{presentation:inspectorOpen?(mobile?'sheet':'drawer'):'hidden'},
    control:{presentation:'inline'},
    ambient:{mode:takeover?'takeover':attention==='needs-you'?'attention':'active'},
  };
}
