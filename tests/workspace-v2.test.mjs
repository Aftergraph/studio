import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIMARY_NAV,
  WORKSPACE_NAV,
  canonicalDomainForNav,
  commandDomainEntries,
  deriveWorkspaceLayout,
} from '../src/workspace-shell.mjs';

test('legacy shell export names resolve to the v3 human-facing mode contract', () => {
  assert.deepEqual(PRIMARY_NAV.map(x => x.id), ['chat','work','space']);
  assert.deepEqual(WORKSPACE_NAV.map(x => x.id), ['artifacts']);
  assert.equal(canonicalDomainForNav('artifacts'), 'output');
  assert.deepEqual(commandDomainEntries().map(x => x.domain), ['now','chat','work','agents','brain','research','capabilities','output','control','connect','system']);
});

test('desktop artifact work remains split and conversation-density focused', () => {
  const layout = deriveWorkspaceLayout({device:'desktop',domain:'chat',artifactOpen:true});
  assert.equal(layout.artifactPresentation, 'split');
  assert.equal(layout.primaryDensity, 'conversation');
});

test('mobile artifact work is full-screen while canonical inspector stays sheet-based', () => {
  const layout = deriveWorkspaceLayout({device:'mobile',domain:'chat',artifactOpen:true,inspectorOpen:true});
  assert.equal(layout.artifactPresentation, 'fullscreen');
  assert.equal(layout.inspectorPresentation, 'sheet');
  assert.equal(layout.mobileModes.length, 3);
});

test('destructive approval becomes focused control presentation', () => {
  const layout = deriveWorkspaceLayout({device:'desktop',domain:'work',artifactOpen:true,inspectorOpen:true,destructiveApproval:true});
  assert.equal(layout.controlPresentation, 'focus');
  assert.equal(layout.artifactPresentation, 'background');
  assert.equal(layout.inspectorPresentation, 'hidden');
});
