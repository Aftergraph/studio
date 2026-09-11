// Studio workspace experience — behavioral conformance to HUMAN-GOVERNANCE-V1.
// Workspace experience (layout, presence, surfaces) bound to the immutable
// tenant binding held in the tenant/trust registry. Experience renders and
// organizes ONLY: mints no grants, keeps no ledger, changes no binding,
// never crosses tenants except via governed export/filter/new-identity/import.
//
// Runner: node --test tests/*.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as experience from '../src/workspace/workspace-experience.mjs';
import { createInteractionSurfaceProjection } from '../src/interaction/interaction-projection.mjs';

const {
  freezeTenantBinding,
  createWorkspaceExperience,
  renderWorkspaceExperience,
  updateWorkspaceExperience,
  exportWorkspaceSnapshot,
  importWorkspaceSnapshot,
} = experience;

function binding(id = 'tenant:acme', extra = {}) {
  return { tenantId: id, workspaceId: `ws:${id}`, ...extra };
}

function acmeAgents() {
  return [
    { id: 'agent_data', name: 'Data Analysis Agent', state: 'running', task: 'Q4 metrics' },
    { id: 'agent_research', name: 'Research Agent', state: 'idle', task: 'Competitor research' },
  ];
}

// ── Binding ─────────────────────────────────────────────────────────────

test('RED: workspace experience module exposes the governed seam only', () => {
  for (const fn of [
    freezeTenantBinding,
    createWorkspaceExperience,
    renderWorkspaceExperience,
    updateWorkspaceExperience,
    exportWorkspaceSnapshot,
    importWorkspaceSnapshot,
  ]) assert.equal(typeof fn, 'function');
});

test('experience requires a tenant binding with a tenantId', () => {
  assert.throws(() => createWorkspaceExperience({}), /tenant binding|tenantId/i);
  assert.throws(() => createWorkspaceExperience({ tenantBinding: {} }), /tenantId/i);
  assert.throws(() => createWorkspaceExperience({ tenantBinding: { tenantId: '' } }), /tenantId/i);
  assert.throws(() => createWorkspaceExperience({ tenantBinding: null }), /tenant binding|tenantId/i);
});

test('tenant binding is frozen and immutable', () => {
  const b = freezeTenantBinding(binding());
  assert.ok(Object.isFrozen(b));
  assert.throws(() => { b.tenantId = 'tenant:evil'; }, TypeError);
  assert.equal(b.tenantId, 'tenant:acme');
});

test('create does not mutate the caller binding and holds a frozen binding', () => {
  const input = binding();
  const snapshot = { ...input };
  const wx = createWorkspaceExperience({ tenantBinding: input });
  assert.deepEqual({ ...input }, snapshot);
  assert.ok(Object.isFrozen(wx.tenantBinding));
  assert.equal(wx.tenantBinding.tenantId, 'tenant:acme');
});

// ── Scoped render: layout / presence / surfaces ─────────────────────────

test('layout is derived and tenant-scoped', () => {
  const wx = createWorkspaceExperience({
    tenantBinding: binding(),
    layout: { device: 'desktop', domain: 'chat', artifactOpen: true },
  });
  assert.equal(wx.layout.tenantId, 'tenant:acme');
  assert.equal(wx.layout.artifactPresentation, 'split');
  assert.equal(wx.layout.primaryDensity, 'conversation');
  assert.ok(Object.isFrozen(wx.layout));
});

test('presence is tenant-tagged and frozen', () => {
  const wx = createWorkspaceExperience({
    tenantBinding: binding(),
    user: { id: 'u1', name: 'Alice', role: 'operator' },
    agents: acmeAgents(),
  });
  assert.ok(wx.presence.length >= 3);
  for (const p of wx.presence) assert.equal(p.tenantId, 'tenant:acme');
  assert.ok(Object.isFrozen(wx.presence));
});

test('presence isolates tenants: A never renders B members', () => {
  const a = createWorkspaceExperience({
    tenantBinding: binding('tenant:acme'),
    user: { id: 'u_acme', name: 'Alice' },
    agents: [{ id: 'a_acme', name: 'Acme Agent', state: 'running' }],
  });
  const b = createWorkspaceExperience({
    tenantBinding: binding('tenant:globex'),
    user: { id: 'u_globex', name: 'Bob' },
    agents: [{ id: 'a_globex', name: 'Globex Agent', state: 'running' }],
  });
  const renderedA = renderWorkspaceExperience(a);
  assert.equal(renderedA.tenantId, 'tenant:acme');
  assert.ok(renderedA.presence.every((p) => p.tenantId === 'tenant:acme'));
  assert.ok(!renderedA.presence.some((p) => p.id === 'u_globex' || p.id === 'a_globex'));
  assert.ok(!JSON.stringify(renderedA).includes('globex'));
  const renderedB = renderWorkspaceExperience(b);
  assert.ok(!JSON.stringify(renderedB).includes('acme'));
});

test('surfaces are tenant-scoped', () => {
  const wx = createWorkspaceExperience({
    tenantBinding: binding(),
    surfaces: [{ kind: 'mission-detail', title: 'M1' }],
  });
  assert.equal(wx.surfaces[0].tenantId, 'tenant:acme');
  assert.equal(wx.surfaces[0].kind, 'mission-detail');
  assert.ok(Object.isFrozen(wx.surfaces));
});

test('rendered layout never leaks the other tenant', () => {
  const a = createWorkspaceExperience({
    tenantBinding: binding('tenant:acme'),
    layout: { device: 'desktop', domain: 'chat', artifactOpen: true },
    surfaces: [{ kind: 'mission-detail', ref: 'acme-only' }],
  });
  const rendered = renderWorkspaceExperience(a);
  assert.equal(rendered.tenantId, 'tenant:acme');
  assert.equal(rendered.layout.tenantId, 'tenant:acme');
  assert.ok(!JSON.stringify(rendered).includes('globex'));
});

// ── Renders and organizes ONLY ──────────────────────────────────────────

test('experience mints no grants', () => {
  const names = Object.keys(experience);
  assert.ok(!names.some((n) => /grant|mint|issue|delegate|authority/i.test(n)));
  const wx = createWorkspaceExperience({ tenantBinding: binding() });
  assert.ok(!('grants' in wx));
  assert.ok(!('mintGrant' in wx));
  assert.ok(!JSON.stringify(wx).includes('grant:'));
});

test('experience keeps no ledger', () => {
  const names = Object.keys(experience);
  assert.ok(!names.some((n) => /ledger|audit|append|consent/i.test(n)));
  const wx = createWorkspaceExperience({ tenantBinding: binding() });
  assert.ok(!('ledger' in wx));
  assert.ok(!('audit' in wx));
});

test('experience changes no binding: no mutator, update preserves reference', () => {
  const names = Object.keys(experience);
  assert.ok(!names.some((n) => /setTenant|updateBinding|mutate|switchTenant|changeTenant/i.test(n)));
  const wx = createWorkspaceExperience({ tenantBinding: binding() });
  const next = updateWorkspaceExperience(wx, { layout: { device: 'mobile', domain: 'chat' } });
  assert.ok(next.tenantBinding === wx.tenantBinding);
  assert.ok(Object.isFrozen(next.tenantBinding));
  assert.equal(next.tenantBinding.tenantId, 'tenant:acme');
  assert.throws(
    () => updateWorkspaceExperience(wx, { tenantBinding: binding('tenant:evil') }),
    /binding/i,
  );
  assert.throws(() => updateWorkspaceExperience(wx, { tenantId: 'tenant:evil' }), /binding/i);
});

// ── Tenant crossing fails closed; governed path only ────────────────────

test('direct cross-tenant mixing fails closed', () => {
  assert.throws(
    () =>
      createWorkspaceExperience({
        tenantBinding: binding('tenant:acme'),
        agents: [{ id: 'a_x', name: 'X', tenantId: 'tenant:globex' }],
      }),
    /tenant/i,
  );
  assert.throws(
    () =>
      createWorkspaceExperience({
        tenantBinding: binding('tenant:acme'),
        surfaces: [{ kind: 'mission-detail', tenantId: 'tenant:globex' }],
      }),
    /tenant/i,
  );
  const wx = createWorkspaceExperience({ tenantBinding: binding('tenant:acme') });
  assert.throws(
    () => updateWorkspaceExperience(wx, { surfaces: [{ kind: 'mission-detail', tenantId: 'tenant:globex' }] }),
    /tenant/i,
  );
});

test('governed export requires a filter and carries provenance', () => {
  const wx = createWorkspaceExperience({
    tenantBinding: binding('tenant:acme'),
    user: { id: 'u1', name: 'Alice' },
    agents: acmeAgents(),
    surfaces: [
      { kind: 'mission-detail', title: 'shareable' },
      { kind: 'evidence-panel', title: 'restricted' },
    ],
  });
  assert.throws(() => exportWorkspaceSnapshot(wx, {}), /filter/i);
  const snap = exportWorkspaceSnapshot(wx, {
    filter: (entry) => entry.kind !== 'evidence-panel' && entry.title !== 'restricted',
    exportedBy: 'human:alice',
  });
  assert.equal(snap.tenantId, 'tenant:acme');
  assert.equal(snap.provenance.fromTenant, 'tenant:acme');
  assert.equal(snap.provenance.exportedBy, 'human:alice');
  assert.ok(snap.exportedAt);
  assert.ok(!snap.surfaces.some((s) => s.title === 'restricted'));
  assert.ok(!JSON.stringify(snap.surfaces).includes('restricted'));
  assert.ok(Object.isFrozen(snap));
});

test('governed import requires a new binding plus new identity', () => {
  const wx = createWorkspaceExperience({
    tenantBinding: binding('tenant:acme'),
    user: { id: 'u1', name: 'Alice' },
    surfaces: [{ kind: 'mission-detail', id: 's1', title: 'shareable' }],
  });
  const snap = exportWorkspaceSnapshot(wx, { filter: () => true, exportedBy: 'human:alice' });
  assert.throws(
    () => importWorkspaceSnapshot(snap, { tenantBinding: binding('tenant:globex') }),
    /identity|reidentify|prefix/i,
  );
  assert.throws(
    () => importWorkspaceSnapshot({ ...snap, provenance: null }, {
      tenantBinding: binding('tenant:globex'),
      newIdPrefix: 'gx_',
    }),
    /provenance/i,
  );
  const imported = importWorkspaceSnapshot(snap, {
    tenantBinding: binding('tenant:globex'),
    newIdPrefix: 'gx_',
  });
  assert.equal(imported.tenantBinding.tenantId, 'tenant:globex');
  assert.ok(imported.presence.every((p) => p.tenantId === 'tenant:globex'));
  assert.ok(imported.surfaces.every((s) => s.tenantId === 'tenant:globex'));
  assert.ok(!imported.surfaces.some((s) => s.id === 's1'));
  assert.ok(imported.surfaces.some((s) => s.id === 'gx_s1'));
  assert.equal(imported.provenance.importedFrom, 'tenant:acme');
  assert.equal(imported.provenance.newTenant, 'tenant:globex');
  // Source snapshot and source experience are unchanged (no in-place mutation).
  assert.equal(snap.tenantId, 'tenant:acme');
  assert.equal(wx.tenantBinding.tenantId, 'tenant:acme');
});

test('workspace accepts same-tenant interaction projection without taking ownership',()=>{
  const interaction=createInteractionSurfaceProjection({tenantId:'tenant:acme',surfaceRef:'studio:surface:chat:1',threadRef:'runtime:thread:1',turnRefs:[],presenceRefs:[],assistantProfile:{id:'friday',label:'Friday'},freshness:'current'});
  const wx=createWorkspaceExperience({tenantBinding:binding('tenant:acme'),interaction});
  assert.equal(wx.interaction.threadRef,'runtime:thread:1');
  assert.equal(wx.interaction.authoritative,false);
});

test('workspace rejects cross-tenant interaction projection',()=>{
  const interaction=createInteractionSurfaceProjection({tenantId:'tenant:globex',surfaceRef:'studio:surface:chat:1',threadRef:'runtime:thread:1',turnRefs:[],presenceRefs:[],assistantProfile:{id:'friday',label:'Friday'},freshness:'current'});
  assert.throws(()=>createWorkspaceExperience({tenantBinding:binding('tenant:acme'),interaction}),/tenant/i);
});

test('governed export and import never transport runtime interaction refs',()=>{
  const interaction=createInteractionSurfaceProjection({tenantId:'tenant:acme',surfaceRef:'studio:surface:chat:1',threadRef:'runtime:thread:1',turnRefs:['runtime:turn:1'],presenceRefs:[],assistantProfile:{id:'friday',label:'Friday'},freshness:'current'});
  const wx=createWorkspaceExperience({tenantBinding:binding('tenant:acme'),interaction});
  const snap=exportWorkspaceSnapshot(wx,{filter:()=>true,exportedBy:'human:alice'});
  assert.equal('interaction' in snap,false);
  const imported=importWorkspaceSnapshot(snap,{tenantBinding:binding('tenant:globex'),newIdPrefix:'gx_'});
  assert.equal('interaction' in imported,false);
  assert.equal(JSON.stringify(imported).includes('runtime:thread:1'),false);
});
