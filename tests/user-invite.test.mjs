import test from 'node:test';
import assert from 'node:assert/strict';
import { AGUserInvite } from '../packages/ui/trust/user-invite.mjs';
import { inviteUser } from '../src/auth/ui-actions.mjs';

const CAPS = ['memory.write', 'goal.manage', 'user.manage'];

test('invite form lists grantable capabilities as checkboxes', () => {
  const html = AGUserInvite({ capabilities: CAPS });
  assert.match(html, /data-ag-component="user-invite"/);
  assert.match(html, /label[^>]*for="invite-user-id"/);
  for (const cap of CAPS) assert.match(html, new RegExp(`value="${cap}"`));
  assert.match(html, /data-auth-action="invite"/);
});

test('invite form renders result without leaking internals', () => {
  const html = AGUserInvite({ capabilities: CAPS, created: { id: 'bob', capabilities: ['memory.write'] } });
  assert.match(html, /bob/);
  assert.match(html, /memory\.write/);
});

test('inviteUser validates before calling backend', async () => {
  const calls = [];
  const client = { async createUser(args) { calls.push(args); return { user: { id: args.id } }; } };
  await assert.rejects(() => inviteUser({ client, userId: '  ', capabilities: [] }), /user id required/i);
  await assert.rejects(() => inviteUser({ client, userId: 'bob', capabilities: [] }), /capabilit/i);
  assert.deepEqual(calls, []);
  const result = await inviteUser({ client, userId: 'bob', capabilities: ['memory.write'] });
  assert.equal(result.user.id, 'bob');
  assert.equal(calls.length, 1);
});
