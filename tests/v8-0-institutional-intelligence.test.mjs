// V8.0 Institutional Intelligence — bounded contract tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { InstitutionalGraph } from '../src/institution/institutional-graph.mjs';
import { AGInstitutionSummary } from '../packages/ui/index.mjs';

function graph() {
  const g = new InstitutionalGraph({ id: 'inst-1' });
  g.registerOrganization({ id: 'org-a', name: 'Acme', parentId: null });
  g.registerOrganization({ id: 'org-b', name: 'Beta', parentId: null });
  g.addMembership({ organizationId: 'org-a', subjectId: 'human:alice', role: 'owner' });
  g.addMembership({ organizationId: 'org-a', subjectId: 'agent:worker', role: 'operator' });
  g.addMembership({ organizationId: 'org-b', subjectId: 'human:bob', role: 'owner' });
  return g;
}

test('Institution: graph requires id and organizations are unique', () => {
  assert.throws(() => new InstitutionalGraph({}), /id/i);
  const g = graph();
  assert.throws(() => g.registerOrganization({ id: 'org-a', name: 'Again' }), /duplicate/i);
  assert.throws(() => g.registerOrganization({ id: 'org-x', name: '' }), /name/i);
});

test('Institution: parent organization must exist and cycles are rejected', () => {
  const g = graph();
  g.registerOrganization({ id: 'org-child', name: 'Child', parentId: 'org-a' });
  assert.throws(() => g.registerOrganization({ id: 'org-loop', name: 'Loop', parentId: 'org-loop' }), /parent|cycle/i);
  assert.throws(() => g.registerOrganization({ id: 'org-ghost', name: 'Ghost', parentId: 'missing' }), /parent/i);
});

test('Institution: memberships are scoped and duplicate role grants rejected', () => {
  const g = graph();
  assert.equal(g.membershipsFor('org-a').length, 2);
  assert.throws(() => g.addMembership({ organizationId: 'org-a', subjectId: 'agent:worker', role: 'operator' }), /duplicate/i);
  assert.throws(() => g.addMembership({ organizationId: 'org-b', subjectId: 'ghost', role: 'root' }), /role/i);
});

test('Institution: policy vocabulary is closed and policy changes require human approval', () => {
  const g = graph();
  assert.throws(() => g.registerPolicy({ id: 'p1', organizationId: 'org-a', operation: 'everything', effect: 'allow' }), /operation/i);
  assert.throws(() => g.registerPolicy({ id: 'p1', organizationId: 'org-a', operation: 'mission.execute', effect: 'allow' }), /human|approval/i);
  g.registerPolicy({ id: 'p1', organizationId: 'org-a', operation: 'mission.execute', effect: 'allow', approvedBy: 'human:alice' });
  assert.equal(g.policiesFor('org-a').length, 1);
});

test('Institution: access requires same-org membership and matching policy', () => {
  const g = graph();
  g.registerPolicy({ id: 'p1', organizationId: 'org-a', operation: 'mission.execute', effect: 'allow', approvedBy: 'human:alice' });
  assert.equal(g.authorize({ organizationId: 'org-a', subjectId: 'agent:worker', operation: 'mission.execute' }), true);
  assert.equal(g.authorize({ organizationId: 'org-a', subjectId: 'human:bob', operation: 'mission.execute' }), false);
  assert.equal(g.authorize({ organizationId: 'org-b', subjectId: 'agent:worker', operation: 'mission.execute' }), false);
  assert.equal(g.authorize({ organizationId: 'org-a', subjectId: 'agent:worker', operation: 'agent.assign' }), false);
});

test('Institution: explicit deny wins over allow', () => {
  const g = graph();
  g.registerPolicy({ id: 'allow', organizationId: 'org-a', operation: 'mission.execute', effect: 'allow', approvedBy: 'human:alice' });
  g.registerPolicy({ id: 'deny', organizationId: 'org-a', operation: 'mission.execute', effect: 'deny', approvedBy: 'human:alice' });
  assert.equal(g.authorize({ organizationId: 'org-a', subjectId: 'agent:worker', operation: 'mission.execute' }), false);
});

test('Institution: cross-org relation fails closed', () => {
  const g = graph();
  assert.throws(() => g.relate({ from: 'org-a', to: 'org-b', type: 'partnered_with' }), /cross-org|organization/i);
  g.relate({ from: 'org-a', to: 'org-a', type: 'governs' });
  assert.equal(g.relations.length, 1);
});

test('Institution: projection is immutable and never carries authority', () => {
  const g = graph();
  const p = g.project('org-a');
  assert.equal(p.organization.id, 'org-a');
  assert.equal(p.authority, 'none');
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(p.memberships));
});

test('Institution: unknown organization and subject fail closed', () => {
  const g = graph();
  assert.equal(g.authorize({ organizationId: 'missing', subjectId: 'human:alice', operation: 'mission.execute' }), false);
  assert.throws(() => g.project('missing'), /organization/i);
});

test('Institution: human owner can approve, agent cannot impersonate owner', () => {
  const g = graph();
  assert.throws(() => g.registerPolicy({ id: 'p1', organizationId: 'org-a', operation: 'mission.execute', effect: 'allow', approvedBy: 'agent:worker' }), /human/i);
});

test('Institution: policy and membership projections preserve tenant boundary', () => {
  const g = graph();
  const a = g.project('org-a');
  const b = g.project('org-b');
  assert.deepEqual(a.memberships.map(x => x.organizationId), ['org-a', 'org-a']);
  assert.deepEqual(b.memberships.map(x => x.organizationId), ['org-b']);
  assert.notDeepEqual(a, b);
});

test('V8.0 exit: organization → membership → policy → scoped authorization', () => {
  const g = graph();
  g.registerPolicy({ id: 'p1', organizationId: 'org-a', operation: 'mission.execute', effect: 'allow', approvedBy: 'human:alice' });
  const projection = g.project('org-a');
  assert.equal(g.authorize({ organizationId: projection.organization.id, subjectId: 'agent:worker', operation: 'mission.execute' }), true);
  assert.equal(g.authorize({ organizationId: 'org-b', subjectId: 'agent:worker', operation: 'mission.execute' }), false);
  assert.equal(projection.authority, 'none');
});

test('V8 API: institutional route enforces human mutation and exposes scoped projection', async () => {
  const { createFederationKernel } = await import('../src/federation/federation-kernel.mjs');
  const { createFederationApiHandler } = await import('../server/federation-routes.mjs');
  const handler = createFederationApiHandler({ kernel: createFederationKernel() });
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (!handler(req, res, url)) { res.writeHead(404); res.end('{}'); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, payload) => {
    const response = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    return { response, body: await response.json() };
  };
  try {
    const rejected = await post('/api/v1/federation/institutional/organization', { id: 'org-a', name: 'Acme', approvedBy: 'agent:worker' });
    assert.equal(rejected.response.status, 400);
    const organization = await post('/api/v1/federation/institutional/organization', { id: 'org-a', name: 'Acme', approvedBy: 'human:alice' });
    assert.equal(organization.body.ok, true);
    const member = await post('/api/v1/federation/institutional/membership', { organizationId: 'org-a', subjectId: 'agent:worker', role: 'operator', approvedBy: 'human:alice' });
    assert.equal(member.body.ok, true);
    const policy = await post('/api/v1/federation/institutional/policy', { id: 'p1', organizationId: 'org-a', operation: 'mission.execute', effect: 'allow', approvedBy: 'human:alice' });
    assert.equal(policy.body.ok, true);
    const allowed = await fetch(`${base}/api/v1/federation/institutional/authorize?organizationId=org-a&subjectId=agent%3Aworker&operation=mission.execute`).then(r => r.json());
    assert.equal(allowed.allowed, true);
    const projection = await fetch(`${base}/api/v1/federation/institutional/projection?organizationId=org-a`).then(r => r.json());
    assert.equal(projection.authority, 'none');
    assert.equal(projection.projection.memberships.length, 1);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('Institution UI exposes organization scope without presenting authority', () => {
  const html = AGInstitutionSummary({ projection: { organization: { name: 'Acme' }, memberships: [{}, {}], policies: [{}], authority: 'none' } });
  assert.match(html, /data-ag-component="institution-summary"/);
  assert.match(html, /Acme/);
  assert.match(html, /2 members/);
  assert.match(html, /Authority: none/);
});
