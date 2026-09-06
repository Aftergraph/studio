import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIMARY_MODES,
  SIDEBAR_UTILITIES,
  canonicalDomainForNav,
  commandDomainEntries,
  deriveWorkspaceLayout,
} from '../src/workspace-shell.mjs';

test('premium V5 shell exposes only Chat, Work and Space as permanent modes', () => {
  assert.deepEqual(PRIMARY_MODES.map(x => x.id), ['chat','work','space']);
  assert.deepEqual(SIDEBAR_UTILITIES.map(x => x.id), ['artifacts']);
  assert.equal(canonicalDomainForNav('chat'), 'chat');
  assert.equal(canonicalDomainForNav('work'), 'work');
  assert.equal(canonicalDomainForNav('artifacts'), 'output');
  assert.deepEqual(commandDomainEntries().map(x => x.domain), ['now','chat','work','agents','brain','research','capabilities','output','control','connect','system']);
});

test('clean chat keeps artifact closed until explicitly opened', () => {
  const layout = deriveWorkspaceLayout({
    device:'desktop',
    domain:'chat',
    artifactOpen:false,
    inspectorOpen:false,
    destructiveApproval:false,
  });
  assert.equal(layout.artifactPresentation, 'hidden');
  assert.equal(layout.primaryDensity, 'conversation');
});

test('desktop artifact opens as dedicated split pane like artifact-first competitors', () => {
  const layout = deriveWorkspaceLayout({
    device:'desktop',
    domain:'chat',
    artifactOpen:true,
    inspectorOpen:false,
    destructiveApproval:false,
  });
  assert.equal(layout.artifactPresentation, 'split');
});

test('mobile uses mode switch rather than persistent four-item navigation', () => {
  const layout = deriveWorkspaceLayout({
    device:'mobile',
    domain:'chat',
    artifactOpen:true,
    inspectorOpen:true,
    destructiveApproval:false,
  });
  assert.deepEqual(layout.mobileModes.map(x => x.id), ['chat','work','space']);
  assert.equal(layout.artifactPresentation, 'fullscreen');
  assert.equal(layout.inspectorPresentation, 'sheet');
});

test('destructive approval remains a focused control surface', () => {
  const layout = deriveWorkspaceLayout({
    device:'desktop',
    domain:'work',
    artifactOpen:true,
    inspectorOpen:true,
    destructiveApproval:true,
  });
  assert.equal(layout.controlPresentation, 'focus');
  assert.equal(layout.artifactPresentation, 'background');
  assert.equal(layout.inspectorPresentation, 'hidden');
});
