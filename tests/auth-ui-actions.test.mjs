import test from 'node:test';
import assert from 'node:assert/strict';
import { requestAuthToken, signInWithToken, signOut } from '../src/auth/ui-actions.mjs';

const fakeClient = ({ token = 'v1.alice.exp.sig', user = { id: 'alice', name: 'Alice', role: 'member', capabilities: ['memory.write'] }, meId = 'alice' } = {}) => ({
  calls: [],
  async issueMagicToken({ userId }) { this.calls.push(['issue', userId]); if (userId === 'ghost') { const e = new Error('user_not_found'); e.code = 'user_not_found'; throw e; } return { token, userId }; },
  async authMe() { this.calls.push(['me']); return { userId: meId }; },
  async readUser(id) { this.calls.push(['read', id]); if (id !== user.id) { const e = new Error('user_not_found'); e.code = 'user_not_found'; throw e; } return user; },
  setAuthToken(t) { this.calls.push(['token', t]); this.current = t; },
});

test('request returns token for known user', async () => {
  const client = fakeClient();
  const result = await requestAuthToken({ client, userId: 'alice' });
  assert.equal(result.token, 'v1.alice.exp.sig');
  assert.equal(result.userId, 'alice');
});

test('request surfaces unknown user cleanly', async () => {
  const client = fakeClient();
  await assert.rejects(() => requestAuthToken({ client, userId: 'ghost' }), /unknown user/i);
});

test('request rejects blank user id without calling backend', async () => {
  const client = fakeClient();
  await assert.rejects(() => requestAuthToken({ client, userId: '  ' }), /user id required/i);
  assert.deepEqual(client.calls, []);
});

test('sign-in binds token before protected user read', async () => {
  const client = fakeClient();
  const result = await signInWithToken({ client, token: 'v1.alice.exp.sig' });
  assert.equal(result.user.id, 'alice');
  assert.deepEqual(client.calls.slice(0, 3), [
    ['me'],
    ['token', 'v1.alice.exp.sig'],
    ['read', 'alice'],
  ]);
});

test('sign-in clears a bound token when protected user read fails', async () => {
  const client = fakeClient({ meId: 'missing' });
  await assert.rejects(() => signInWithToken({ client, token: 'v1.alice.exp.sig' }), /user_not_found/);
  assert.equal(client.current, null);
});

test('sign-out clears the client token', () => {
  const client = fakeClient();
  client.current = 'v1.old';
  signOut({ client });
  assert.equal(client.current, null);
});
