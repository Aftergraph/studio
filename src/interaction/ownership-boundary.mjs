export const INTERACTION_OWNERS=Object.freeze({
  InteractionSurface:'studio',
  AssistantProfile:'studio',
  Presence:'runtime',
  InteractionThread:'runtime',
  InteractionTurn:'runtime',
  HandoffCheckpoint:'runtime',
  TenantBinding:'trust-gateway',
  DurableWork:'works-execution',
  Verification:'sentinel',
});

export const ownerForInteractionKind=kind=>INTERACTION_OWNERS[kind]??null;

export function assertStudioMayOwn(kind){
  const owner=ownerForInteractionKind(kind);
  if(owner!=='studio') {
    throw new Error(`${kind} is owned by ${owner||'unknown'}, not studio`);
  }
  return true;
}
