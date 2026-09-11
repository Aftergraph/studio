import test from 'node:test';
import assert from 'node:assert/strict';
import {ownerForInteractionKind,assertStudioMayOwn} from '../src/interaction/ownership-boundary.mjs';

test('Studio owns surfaces/profile presentation but not runtime turn truth',()=>{
  assert.equal(ownerForInteractionKind('InteractionSurface'),'studio');
  assert.equal(ownerForInteractionKind('AssistantProfile'),'studio');
  assert.equal(ownerForInteractionKind('InteractionThread'),'runtime');
  assert.equal(ownerForInteractionKind('InteractionTurn'),'runtime');
  assert.equal(ownerForInteractionKind('HandoffCheckpoint'),'runtime');
  assert.throws(()=>assertStudioMayOwn('InteractionTurn'),/runtime/i);
  assert.doesNotThrow(()=>assertStudioMayOwn('InteractionSurface'));
});

test('unknown interaction kinds fail closed instead of defaulting to Studio',()=>{
  assert.equal(ownerForInteractionKind('UnknownThing'),null);
  assert.throws(()=>assertStudioMayOwn('UnknownThing'),/unknown/i);
});
