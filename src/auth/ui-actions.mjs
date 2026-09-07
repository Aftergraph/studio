// Login UI slice-2: testable auth flows over an injected api client.
// Browser bundle-safe (no node imports); bootstrap wires DOM events to these.
export async function requestAuthToken({ client, userId } = {}) {
  const id = String(userId || '').trim();
  if (!id) throw new Error('user id required');
  try {
    const issued = await client.issueMagicToken({ userId: id });
    if (!issued?.token) throw new Error('token not issued');
    return { token: issued.token, userId: issued.userId || id };
  } catch (error) {
    if (error?.code === 'user_not_found') throw new Error('unknown user — ask an operator to create it first');
    throw error;
  }
}

export async function signInWithToken({ client, token } = {}) {
  if (!token) throw new Error('token required');
  const me = await client.authMe({ token });
  if (!me?.userId) throw new Error('token not accepted');
  const user = await client.readUser(me.userId);
  client.setAuthToken(token);
  return { user, token };
}

export function signOut({ client } = {}) {
  client.setAuthToken(null);
  return { signedOut: true };
}

export async function inviteUser({ client, userId, capabilities = [] } = {}) {
  const id = String(userId || '').trim();
  if (!id) throw new Error('user id required');
  if (!Array.isArray(capabilities) || !capabilities.length) throw new Error('tick at least one capability');
  try {
    const created = await client.createUser({ id, capabilities });
    if (!created?.user) throw new Error('user not created');
    return created;
  } catch (error) {
    if (error?.code === 'invalid_capability') throw new Error('server rejected a capability — refresh the list');
    throw error;
  }
}
