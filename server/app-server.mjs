import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { API_VERSION, sendJson, readJson } from './http-utils.mjs';
import { createSSEBroker } from './sse-broker.mjs';
import { serveStatic } from './static-handler.mjs';
import { isApiRequest, sendApiError } from './api-router.mjs';
import { appendChatMessage, decideApproval, setTakeover, createInitialState } from '../src/state.mjs';
import { WorkspaceStateStore } from '../src/server-store.mjs';
import { MissionRuntimeHub } from '../src/server-runtime-hub.mjs';
import { reduceSpatialState } from '../packages/spatial/index.mjs';
import { buildReplayFrames } from '../src/replay.mjs';
import { buildTemporalFrames, reconstructAt, counterfactualAt, futureTrajectory } from '../src/temporal/temporal-intelligence.mjs';
import { createActionGuard, assertActorCapability, requireResetConfirmation, RESET_CONFIRMATION } from '../src/action-guard.mjs';
import { createUser, getUser, updateCapabilities } from '../src/user/user-store.mjs';
import { listGrantableCapabilities } from '../src/user/capability-set.mjs';
import { createGoal } from '../src/goal/goal-schema.mjs';
import { createLesson } from '../src/goal/goal-lesson.mjs';
import { assessGoalDrift } from '../src/goal/goal-drift.mjs';
import { issueMagicToken, subjectFromAuthHeader, authSecretFromEnv } from '../src/auth/magic-link.mjs';
import { createRateLimiter } from '../src/auth/rate-limit.mjs';
import { createKillSwitch, engageKill, releaseKill, assertAutonomyAllowed } from '../src/autonomy/bounds.mjs';
import { CostLedger } from '../src/economy/outcome-economy.mjs';
import { createKnowledgeEntry, promoteKnowledge, isAuthoritative } from '../src/brain/knowledge.mjs';
import { createServerLog } from '../src/distributed/server-log.mjs';
import { createUpstreamHub } from '../src/integrations/upstream-hub.mjs';
import { createFederationApiHandler } from './federation-routes.mjs';


function resolveRoot(root) {
  if (root instanceof URL) return fileURLToPath(root);
  return path.resolve(root || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
}


function contextProjection(state, conversationId) {
  const conversation = state.conversations.find(c => c.id === conversationId) || null;
  const mission = conversation?.missionId ? state.missions.find(m => m.id === conversation.missionId) || null : null;
  const artifacts = mission ? state.artifacts.filter(a => a.missionId === mission.id) : [];
  return {
    conversation,
    mission,
    artifacts,
    memory:state.memory,
    connections:state.connections,
    agents:state.agents,
    permissions:state.user.capabilities,
  };
}

export function upstreamConfigFromEnv(env=process.env) {
  const clean=value=>typeof value==='string'&&value.trim()?value.trim():undefined;
  return {
    trustGateway:{ baseUrl:clean(env.AFTERGRAPH_TG_URL), token:clean(env.AFTERGRAPH_TG_TOKEN) },
    works:{ baseUrl:clean(env.AFTERGRAPH_WORKS_URL), token:clean(env.AFTERGRAPH_WORKS_TOKEN), brainPrefix:clean(env.AFTERGRAPH_WORKS_BRAIN_PREFIX) },
    aie:{ baseUrl:clean(env.AFTERGRAPH_AIE_URL), tenant:clean(env.AFTERGRAPH_AIE_TENANT) },
    workIntelligence:{ baseUrl:clean(env.AFTERGRAPH_WI_URL), token:clean(env.AFTERGRAPH_WI_TOKEN) },
  };
}

export function createAppServer({ root, stateFile, runtimeIntervalMs = 1250, upstreamConfig = null, federation = null, fixtures = true, authSecret = null, requireAuth = process.env.AFTERGRAPH_REQUIRE_AUTH === 'true', maxUserStores = 100 } = {}) {
  const rootDir = resolveRoot(root);
  const secret = authSecret || authSecretFromEnv();
  // ponytail: requireAuth turns Bearer binding into enforcement. The operator
  // bootstraps with the boot token (valid 24h); email challenge is the
  // documented follow-up before multi-operator production.
  const bootToken = requireAuth ? issueMagicToken({ userId: 'demo-user', secret, ttlMs: 24 * 60 * 60 * 1000 }) : null;
  // ponytail: auth-booth abuse brake — 10 issuances per IP per hour.
  const magicLinkLimiter = createRateLimiter({ maxHits: 10, windowMs: 60 * 60 * 1000 });
  // ponytail: per-user workspace isolation. One store+hub+synclog per actor id,
  // lazily created; autonomy ledger and kill-switches stay global (portfolio stop).
  const DEFAULT_ACTOR = 'demo-user';
  const stores = new Map();
  const hubs = new Map();
  const syncLogs = new Map();
  const storeFor = (actor) => {
    const id = actor || DEFAULT_ACTOR;
    let entry = stores.get(id);
    if (!entry) {
      entry = new WorkspaceStateStore({ stateFile: stateFile ? `${stateFile}.${id}` : undefined, initialState: createInitialState({ fixtures }) });
      entry.readyP = entry.init();
      entry.lastAccess = Date.now();
      stores.set(id, entry);
      evictIdleStores();
    }
    entry.lastAccess = Date.now();
    return entry;
  };
  // ponytail: bound memory — evict least-recently-used idle scopes past the
  // cap. Default scope is never evicted; evicted users reseed on next access
  // (persisted stateFile reloads their data).
  const evictIdleStores = () => {
    if (stores.size <= maxUserStores) return;
    const candidates = [...stores.keys()]
      .filter(key => key !== DEFAULT_ACTOR)
      .map(key => ({ key, at: stores.get(key).lastAccess || 0 }))
      .sort((a, b) => a.at - b.at);
    for (const { key } of candidates) {
      if (stores.size <= maxUserStores) break;
      try { hubs.get(key)?.stopAll?.(); } catch {}
      hubs.delete(key);
      syncLogs.delete(key);
      stores.delete(key);
    }
  };
  const hubFor = (actor) => {
    const id = actor || DEFAULT_ACTOR;
    let hub = hubs.get(id);
    if (!hub) {
      hub = new MissionRuntimeHub({
        store: storeFor(id),
        intervalMs: runtimeIntervalMs,
        onChange: payload => broadcast(payload),
        isHalted: missionId => killSwitches.get(`mission:${missionId}`)?.engaged === true,
      });
      hubs.set(id, hub);
    }
    return hub;
  };
  const logFor = (actor) => {
    const id = actor || DEFAULT_ACTOR;
    let log = syncLogs.get(id);
    if (!log) { log = createServerLog(); syncLogs.set(id, log); }
    return log;
  };
  const store = storeFor(DEFAULT_ACTOR);
  const upstreamHub=createUpstreamHub(upstreamConfig || upstreamConfigFromEnv());
  const sse=createSSEBroker({version:API_VERSION});
  const federationHandler=federation?.kernel?createFederationApiHandler(federation):null;
  const broadcast=payload=>sse.broadcast(payload);
  const ready = store.init();
  const actionGuard=createActionGuard();
  // ponytail: registry is module-singleton; seed is idempotent (overwrite),
  // so repeated server instances in tests converge on the same demo-user.
  const userRegistry={getUser};
  try {
    createUser({id:'demo-user',name:'Demo User',role:'operator',capabilities:[
      'approval.decide','autonomy.check','autonomy.kill','autonomy.record',
      'memory.promote','memory.revoke','memory.write','mission.control',
      'workspace.reset','user.manage','auth.issue','goal.manage',
    ]});
  } catch { /* seeded already */ }
  const beginAction=(req,body,capability,path,confirmation=false)=>{
    const snapshot=storeFor(body?.actor).snapshot();
    if(!body?.actor) { const error=new Error('actor required');error.code='actor_required';error.status=422;throw error; }
    try { assertActorCapability({state:snapshot,actor:body.actor,capability,users:userRegistry}); }
    catch (error) { error.code='forbidden';error.status=403;throw error; }
    if(confirmation) { try { requireResetConfirmation(body.confirmationToken); } catch(error) { error.code='confirmation_required';error.status=422;throw error; } }
    const key=req.headers['idempotency-key']||body.idempotencyKey;
    if(!key) { const error=new Error('idempotency key required');error.code='idempotency_conflict';error.status=422;throw error; }
    try { return { key:`${body?.actor || DEFAULT_ACTOR}:${req.method}:${path}:${key}`, state:actionGuard.begin(`${body?.actor || DEFAULT_ACTOR}:${req.method}:${path}:${key}`) }; }
    catch(error) { error.code='idempotency_conflict';error.status=409;throw error; }
  };
  const completeAction=(key,result)=>actionGuard.complete(key,result);
  const failAction=(key,error)=>{actionGuard.fail(key,error?.message||error);throw error;};
  const syncLog=logFor(DEFAULT_ACTOR);
  const autonomyLedger=new CostLedger({id:'workspace-autonomy'});
  const killSwitches=new Map();
  const killFor=scope=>killSwitches.get(scope)??createKillSwitch({id:`ks-${scope}`,scope});
  const runtimeHub = hubFor(DEFAULT_ACTOR);

  const server = http.createServer(async (req, res) => {
    await ready;
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    // ponytail: per-request scope. GETs scope via ?actor=; mutating routes
    // rescope from body right after readJson (see rescope calls below).
    const queryActor = url.searchParams.get('actor') || undefined;
    let store = storeFor(DEFAULT_ACTOR);
    let runtimeHub = hubFor(DEFAULT_ACTOR);
    let syncLog = logFor(DEFAULT_ACTOR);
    const rescope = async (actor) => {
      const bearer = subjectFromAuthHeader(req, { secret });
      // ponytail: enforcement mode — every API route except the auth booth
      // itself requires a valid Bearer token.
      if (requireAuth && !bearer && !url.pathname.startsWith('/api/v1/auth/')) {
        const error = new Error('authentication required');
        error.code = 'authentication_required'; error.status = 401; throw error;
      }
      const scoped = bearer || actor || queryActor;
      // ponytail: fail-closed — only registered users own a workspace.
      // demo-user is seeded at boot; everyone else must POST /api/v1/users first.
      if (!getUser(scoped || DEFAULT_ACTOR)) {
        const error = new Error('forbidden: unknown actor');
        error.code = 'forbidden'; error.status = 403; throw error;
      }
      // ponytail: when a Bearer token is present it binds the request —
      // a claimed actor that differs from the token subject is rejected.
      const claimed = actor || queryActor;
      if (bearer && claimed && bearer !== claimed) {
        const error = new Error('forbidden: token subject mismatch');
        error.code = 'forbidden'; error.status = 403; throw error;
      }
      store = storeFor(scoped);
      runtimeHub = hubFor(scoped);
      syncLog = logFor(scoped);
      await store.readyP;
    };
    if (url.pathname === '/healthz') {
      sendJson(res, 200, { status:'ok', app:'aftergraph-workspace-v5-reference', api:API_VERSION });
      return;
    }
    if (url.pathname === '/api/v1/events' && req.method === 'GET') {
      try { await rescope(); } catch (error) { sendApiError(res, error); return; }
      sse.attach(req,res,{state:store.snapshot(),runtimes:runtimeHub.snapshot()});
      return;
    }

    if (isApiRequest(url)) {
      try { await rescope(); } catch (error) { sendApiError(res, error); return; }
      try {
        if (federationHandler?.(req,res,url)) return;
        if (url.pathname === '/api/v1/state' && req.method === 'GET') {
          sendJson(res, 200, { version:API_VERSION, state:store.snapshot(), runtimes:runtimeHub.snapshot() });
          return;
        }

        if (url.pathname === '/api/v1/upstreams' && req.method === 'GET') {
          const services=await upstreamHub.status();
          sendJson(res, 200, { version:API_VERSION, services });
          return;
        }

        if (url.pathname === '/api/v1/upstreams/sync' && req.method === 'POST') {
          await rescope();
                    const upstreams=await upstreamHub.sync();
          const next=await store.mutate(draft=>{
            draft.upstreams=upstreams;
            draft.events.unshift({id:`ev_${Date.now()}`,type:'upstreams.synced',text:'Canonical Aftergraph upstream projections synchronized',time:'now'});
            return draft;
          });
          broadcast({ state:next, runtimes:runtimeHub.snapshot(), upstreams });
          sendJson(res, 200, { version:API_VERSION, upstreams, state:next });
          return;
        }

        let upstreamMatch=url.pathname.match(/^\/api\/v1\/upstreams\/trust-gateway\/approvals\/([^/]+)\/decision$/);
        if (upstreamMatch && req.method === 'POST') {
          const body=await readJson(req);
          if(!['approve','approved','deny','denied','reject','rejected'].includes(String(body.decision||''))){sendJson(res,422,{error:'invalid_approval_decision'});return;}
          const result=await upstreamHub.decideTrustGatewayApproval(decodeURIComponent(upstreamMatch[1]),body.decision);
          sendJson(res,200,{version:API_VERSION,result});
          return;
        }

        upstreamMatch=url.pathname.match(/^\/api\/v1\/upstreams\/works\/([^/]+)\/control$/);
        if (upstreamMatch && req.method === 'POST') {
          const body=await readJson(req);
          if(!['suspend','resume','cancel'].includes(body.action)){sendJson(res,422,{error:'invalid_works_control_action'});return;}
          const result=await upstreamHub.controlWork(decodeURIComponent(upstreamMatch[1]),body.action,body.payload||{});
          sendJson(res,200,{version:API_VERSION,result});
          return;
        }

        upstreamMatch=url.pathname.match(/^\/api\/v1\/upstreams\/work-intelligence\/([^/]+)\/review$/);
        if (upstreamMatch && req.method === 'POST') {
          const body=await readJson(req);
          if(!body.actor||!body.decision){sendJson(res,422,{error:'review_actor_and_decision_required'});return;}
          const result=await upstreamHub.reviewWorkIntelligence(decodeURIComponent(upstreamMatch[1]),{actor:body.actor,decision:body.decision});
          sendJson(res,200,{version:API_VERSION,result});
          return;
        }

        upstreamMatch=url.pathname.match(/^\/api\/v1\/upstreams\/work-intelligence\/([^/]+)\/promote$/);
        if (upstreamMatch && req.method === 'POST') {
          const body=await readJson(req);
          if(body.confirmed!==true||!body.actor){sendJson(res,422,{error:'explicit_confirmation_required'});return;}
          const result=await upstreamHub.promoteWorkIntelligence(decodeURIComponent(upstreamMatch[1]),{actor:body.actor,confirmed:true});
          sendJson(res,200,{version:API_VERSION,result});
          return;
        }

        upstreamMatch=url.pathname.match(/^\/api\/v1\/upstreams\/aie\/tasks\/([^/]+)\/cancel$/);
        if (upstreamMatch && req.method === 'POST') {
          const result=await upstreamHub.cancelAieTask(decodeURIComponent(upstreamMatch[1]));
          sendJson(res,200,{version:API_VERSION,result});
          return;
        }

        if (url.pathname === '/api/v1/upstreams/aie/messages' && req.method === 'POST') {
          const body=await readJson(req);
          if(!body?.message?.messageId){sendJson(res,422,{error:'message_id_required'});return;}
          const result=await upstreamHub.sendAieMessage(body);
          sendJson(res,200,{version:API_VERSION,result});
          return;
        }

        if (req.method === 'GET') {
          const snapshot = store.snapshot();
          const resources = {
            '/api/v1/needs':['needsYou', snapshot.needsYou],
            '/api/v1/missions':['missions', snapshot.missions],
            '/api/v1/agents':['agents', snapshot.agents],
            '/api/v1/artifacts':['artifacts', snapshot.artifacts],
            '/api/v1/connections':['connections', snapshot.connections],
            '/api/v1/spaces':['spaces', snapshot.spaces || []],
          };
          const resource = resources[url.pathname];
          if (resource) {
            sendJson(res, 200, { version:API_VERSION, [resource[0]]:resource[1] });
            return;
          }
          if (url.pathname === '/api/v1/system') {
            const runtimes=runtimeHub.snapshot();
            sendJson(res, 200, {
              version:API_VERSION,
              telemetry:snapshot.telemetry,
              user:{ id:snapshot.user.id, role:snapshot.user.role, capabilities:snapshot.user.capabilities },
              backend:{ runtimeCount:Object.keys(runtimes).length, eventClients:sse.clientCount(), runtimes },
            });
            return;
          }
        }

        if (url.pathname === '/api/v1/context' && req.method === 'GET') {
          const conversationId = url.searchParams.get('conversationId') || store.snapshot().activeConversationId;
          const projection = contextProjection(store.snapshot(), conversationId);
          if (!projection.conversation) { sendJson(res, 404, { error:'conversation_not_found' }); return; }
          sendJson(res, 200, projection);
          return;
        }

        if (url.pathname === '/api/v1/reset' && req.method === 'POST') {
          const body=await readJson(req);
          await rescope(body?.actor);
                    const action=beginAction(req,body,'workspace.reset',url.pathname,true);
          try {
            const next = await store.reset();
            await runtimeHub.reset();
            completeAction(action.key,{status:'accepted'});
            broadcast({ state:next, runtimes:{} });
            sendJson(res, 200, { state:next, runtimes:{} });
          } catch (error) { failAction(action.key,error); }
          return;
        }

        if (url.pathname === '/api/v1/sync/events' && req.method === 'POST') {
          const body=await readJson(req);
          await rescope(body?.actor);
          if(!body?.actor){sendJson(res,422,{error:'actor_required'});return;}
          if(!body?.nodeId||typeof body.nodeId!=='string'){sendJson(res,422,{error:'node_id_required'});return;}
          if(!Array.isArray(body?.events)){sendJson(res,422,{error:'events_required'});return;}
          const key=req.headers['idempotency-key']||body.idempotencyKey;
          if(!key){sendJson(res,422,{error:'idempotency_key_required'});return;}
          try {
            const read=syncLog.submit(body.events);
            sendJson(res,200,{version:API_VERSION,events:read.events,clock:read.clock});
          } catch { sendJson(res,422,{error:'invalid_sync_event'}); }
          return;
        }

        if (url.pathname === '/api/v1/sync/events' && req.method === 'GET') {
          const read=syncLog.read();
          sendJson(res,200,{version:API_VERSION,events:read.events,clock:read.clock});
          return;
        }

        if (url.pathname === '/api/v1/conversations' && req.method === 'POST') {
          const body = await readJson(req);
          await rescope(body?.actor);
          const id = String(body.id || `conv_${Date.now()}`);
          if (!/^conv_[a-zA-Z0-9_-]+$/.test(id)) { sendJson(res, 422, { error:'invalid_conversation_id' }); return; }
          if (store.snapshot().conversations.some(c => c.id === id)) { sendJson(res, 409, { error:'conversation_exists' }); return; }
          const title = String(body.title || 'New conversation').trim().slice(0, 120) || 'New conversation';
          const next = await store.mutate(draft => {
            draft.conversations.unshift({ id, missionId:null, title, updated:'now', status:'idle', messages:[] });
            draft.activeConversationId = id;
            draft.activeDomain = 'chat';
            return draft;
          });
          broadcast({ state:next, runtimes:runtimeHub.snapshot() });
          sendJson(res, 201, { state:next, conversation:next.conversations.find(c=>c.id===id) });
          return;
        }

        let match = url.pathname.match(/^\/api\/v1\/needs\/([^/]+)$/);
        if (match && req.method === 'DELETE') {
          await rescope();
                    const id = decodeURIComponent(match[1]);
          if (!store.snapshot().needsYou.some(n => n.id === id)) { sendJson(res, 404, { error:'need_not_found' }); return; }
          const next = await store.mutate(draft => {
            draft.needsYou = draft.needsYou.filter(n => n.id !== id);
            draft.events.unshift({ id:`ev_${Date.now()}`, type:'need.resolved', text:`Resolved ${id}`, time:'now' });
            return draft;
          });
          broadcast({ state:next, runtimes:runtimeHub.snapshot() });
          sendJson(res, 200, { state:next });
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/conversations\/([^/]+)\/messages$/);
        if (match && req.method === 'POST') {
          const body = await readJson(req);
          await rescope(body?.actor);
          const text = String(body.text || '').trim();
          if (!text) { sendJson(res, 422, { error:'message_required' }); return; }
          const conversationId = decodeURIComponent(match[1]);
          if (!store.snapshot().conversations.some(c => c.id === conversationId)) { sendJson(res, 404, { error:'conversation_not_found' }); return; }
          const attachments=(Array.isArray(body.attachments)?body.attachments:[]).slice(0,8).map(item=>({
            name:String(item?.name||'attachment').trim().slice(0,160)||'attachment',
            kind:String(item?.kind||'file').trim().slice(0,80)||'file',
          }));
          let nextState = appendChatMessage(store.snapshot(), conversationId, {
            author:body.actor || 'user',
            type:'text',
            text,
            mode:String(body.mode || 'Ask'),
            ...(attachments.length?{attachments}:{}),
          });
          if (body.reply && typeof body.reply === 'object' && String(body.reply.text || '').trim()) {
            nextState = appendChatMessage(nextState, conversationId, {
              author:String(body.reply.author || 'Friday'),
              type:String(body.reply.type || 'agent_run'),
              text:String(body.reply.text).trim(),
              missionId:body.reply.missionId || undefined,
              agentId:body.reply.agentId || undefined,
            });
          }
          const next = await store.replace(nextState);
          broadcast({ state:next, runtimes:runtimeHub.snapshot() });
          sendJson(res, 201, { state:next });
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/approvals\/([^/]+)\/decision$/);
        if (match && req.method === 'POST') {
          const body = await readJson(req);
          await rescope(body?.actor);
          const id = decodeURIComponent(match[1]);
          if (!store.snapshot().approvals.some(a => a.id === id)) { sendJson(res, 404, { error:'approval_not_found' }); return; }
          const decision = String(body.decision || '');
          if (!['approved','rejected'].includes(decision)) { sendJson(res, 422, { error:'invalid_decision' }); return; }
          const action=beginAction(req,body,'approval.decide',url.pathname);
          try {
            const next = await store.replace(decideApproval(store.snapshot(), id, decision, body.actor));
            completeAction(action.key,{status:'accepted'});
            broadcast({ state:next, runtimes:runtimeHub.snapshot() });
            sendJson(res, 200, { state:next });
          } catch (error) { failAction(action.key,error); }
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/missions\/([^/]+)\/control$/);
        if (match && req.method === 'POST') {
          const body = await readJson(req);
          await rescope(body?.actor);
          const id = decodeURIComponent(match[1]);
          if (!store.snapshot().missions.some(m => m.id === id)) { sendJson(res, 404, { error:'mission_not_found' }); return; }
          if (!['takeover','observe'].includes(body.mode)) { sendJson(res, 422, { error:'invalid_control_mode' }); return; }
          const action=beginAction(req,body,'mission.control',url.pathname);
          try {
            if (body.mode === 'takeover') await runtimeHub.pause(id);
            const next = await store.replace(setTakeover(store.snapshot(), id, body.mode === 'takeover'));
            completeAction(action.key,{status:'accepted',mode:body.mode});
            broadcast({ state:next, runtimes:runtimeHub.snapshot() });
            sendJson(res, 200, { state:next, runtime:runtimeHub.snapshot()[id] || null });
          } catch (error) { failAction(action.key,error); }
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/missions\/([^/]+)\/runtime$/);
        if (match && req.method === 'POST') {
          const body = await readJson(req);
          await rescope(body?.actor);
          const id = decodeURIComponent(match[1]);
          if (!store.snapshot().missions.some(m => m.id === id)) { sendJson(res, 404, { error:'mission_not_found' }); return; }
          let runtime;
          if (body.action === 'start') runtime = await runtimeHub.start(id);
          else if (body.action === 'step') runtime = await runtimeHub.step(id);
          else if (body.action === 'pause') runtime = await runtimeHub.pause(id);
          else if (body.action === 'resume') runtime = await runtimeHub.resume(id);
          else { sendJson(res, 422, { error:'invalid_runtime_action' }); return; }
          sendJson(res, 200, { state:store.snapshot(), runtime:{ missionId:id, status:runtime.status, tick:runtime.tick, attention:runtime.attention || null } });
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/spaces\/([^/]+)$/);
        if (match && req.method === 'PATCH') {
          const body = await readJson(req);
          await rescope(body?.actor);
          const id = decodeURIComponent(match[1]);
          const snapshot = store.snapshot();
          const index = (snapshot.spaces || []).findIndex(space => space.id === id);
          if (index < 0) { sendJson(res, 404, { error:'space_not_found' }); return; }
          if (!body.action || typeof body.action !== 'object') { sendJson(res, 422, { error:'spatial_action_required' }); return; }
          const next = await store.mutate(draft => {
            draft.spaces[index] = reduceSpatialState(draft.spaces[index], body.action);
            draft.activeSpaceId = id;
            draft.primaryMode = 'space';
            draft.activeDomain = 'work';
            draft.events.unshift({ id:`ev_${Date.now()}`, type:'space.changed', text:`${body.action.type || 'space action'} in ${id}`, time:'now' });
            return draft;
          });
          broadcast({ state:next, runtimes:runtimeHub.snapshot() });
          sendJson(res, 200, { state:next, space:next.spaces[index] });
          return;
        }

        if (url.pathname === '/api/v1/temporal' && req.method === 'GET') {
          const snapshot = store.snapshot();
          const frames = buildTemporalFrames(snapshot.events || [], {});
          const cursor = Number(url.searchParams.get('cursor') ?? snapshot.replay?.cursor ?? 0);
          const mode = url.searchParams.get('mode') || 'historical';
          let temporal = { mode: 'historical', cursor: Math.max(0, Math.min(frames.length - 1, Math.trunc(cursor) || 0)), state: reconstructAt(frames, cursor), frames };
          if (mode === 'counterfactual') {
            const hypothetical = JSON.parse(url.searchParams.get('event') || '{}');
            temporal = counterfactualAt(frames, cursor, hypothetical);
          } else if (mode === 'forecast') {
            const steps = JSON.parse(url.searchParams.get('steps') || '[]');
            temporal = futureTrajectory(frames, cursor, steps);
          } else if (!frames.length) {
            temporal = { mode: 'historical', cursor: -1, state: {}, frames: [] };
          }
          sendJson(res, 200, { ok: true, temporal, authority: 'none' });
          return;
        }

        if (url.pathname === '/api/v1/replay' && req.method === 'PATCH') {
          const body = await readJson(req);
          await rescope(body?.actor);
          const snapshot = store.snapshot();
          const frames = buildReplayFrames(snapshot.events || []);
          const max = Math.max(0, frames.length - 1);
          const requested = Number.isFinite(Number(body.cursor)) ? Number(body.cursor) : Number(snapshot.replay?.cursor || 0);
          const cursor = Math.max(0, Math.min(max, Math.trunc(requested)));
          const playing = typeof body.playing === 'boolean' ? body.playing : Boolean(snapshot.replay?.playing);
          const speed = [0.5,1,2].includes(Number(body.speed)) ? Number(body.speed) : Number(snapshot.replay?.speed || 1);
          const next = await store.mutate(draft => {
            draft.replay = { cursor, playing, speed };
            return draft;
          });
          broadcast({ state:next, runtimes:runtimeHub.snapshot() });
          sendJson(res, 200, { state:next, replay:next.replay, frame:frames[cursor] || null, frameCount:frames.length });
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/artifacts\/([^/]+)$/);
        if (match && req.method === 'GET') {
          const id = decodeURIComponent(match[1]);
          const snapshot = store.snapshot();
          const artifact = snapshot.artifacts.find(a => a.id === id);
          if (!artifact) { sendJson(res, 404, { error:'artifact_not_found' }); return; }
          const mission = snapshot.missions.find(m => m.id === artifact.missionId) || null;
          sendJson(res, 200, { artifact, mission, evidenceCount:mission?.evidenceCount || 0 });
          return;
        }

        if (url.pathname === '/api/v1/memory/authoritative' && req.method === 'GET') {
          // ponytail: legacy seed entries carry promoted:true without lifecycle
          // status; grandfather them instead of rewriting seed history.
          const entries=store.snapshot().memory.filter(m=>isAuthoritative(m)||m.promoted===true);
          sendJson(res,200,{version:API_VERSION,entries});
          return;
        }

        if (url.pathname === '/api/v1/memory' && req.method === 'POST') {
          const body=await readJson(req);
          await rescope(body?.actor);
          const action=beginAction(req,body,'memory.write',url.pathname);
          try {
            const entry=createKnowledgeEntry({
              scope:body.scope,label:body.label,value:body.value,source:body.source,
              confidence:body.confidence??0,retentionMs:body.retentionMs??null,
            });
            const next=await store.mutate(draft=>{draft.memory.unshift(entry);return draft;});
            completeAction(action.key,{status:'accepted'});
            broadcast({state:next,runtimes:runtimeHub.snapshot()});
            sendJson(res,201,{version:API_VERSION,entry});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'invalid_memory_entry'}); }
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/memory\/([^/]+)\/promote$/);
        if (match && req.method === 'POST') {
          const body=await readJson(req);
          await rescope(body?.actor);
          const id=decodeURIComponent(match[1]);
          const found=store.snapshot().memory.find(m=>m.id===id);
          if(!found){sendJson(res,404,{error:'memory_not_found'});return;}
          const action=beginAction(req,body,'memory.promote',url.pathname);
          try {
            const entry=promoteKnowledge(found,{by:body.actor,evidence:body.evidence,override:body.override});
            const next=await store.mutate(draft=>{draft.memory=draft.memory.map(m=>m.id===id?entry:m);return draft;});
            completeAction(action.key,{status:'accepted'});
            broadcast({state:next,runtimes:runtimeHub.snapshot()});
            sendJson(res,200,{version:API_VERSION,entry});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'promotion_rejected'}); }
          return;
        }

        if (url.pathname === '/api/v1/autonomy/kill' && req.method === 'GET') {
          const scope=url.searchParams.get('scope')||'';
          if(!scope){sendJson(res,422,{error:'scope_required'});return;}
          sendJson(res,200,{version:API_VERSION,switch:killFor(scope)});
          return;
        }

        if (url.pathname === '/api/v1/autonomy/kill' && req.method === 'POST') {
          const body=await readJson(req);
          const action=beginAction(req,body,'autonomy.kill',url.pathname);
          try {
            if(!body?.scope||typeof body.scope!=='string')throw Object.assign(new Error('scope required'),{code:'scope_required'});
            const sw=engageKill(killFor(body.scope),{by:body.actor,reason:body.reason});
            killSwitches.set(body.scope,sw);
            completeAction(action.key,{status:'accepted'});
            sendJson(res,200,{version:API_VERSION,switch:sw});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'kill_rejected'}); }
          return;
        }

        if (url.pathname === '/api/v1/autonomy/kill/release' && req.method === 'POST') {
          const body=await readJson(req);
          const action=beginAction(req,body,'autonomy.kill',url.pathname);
          try {
            if(!body?.scope||typeof body.scope!=='string')throw Object.assign(new Error('scope required'),{code:'scope_required'});
            const sw=releaseKill(killFor(body.scope),{by:body.actor});
            killSwitches.set(body.scope,sw);
            completeAction(action.key,{status:'accepted'});
            sendJson(res,200,{version:API_VERSION,switch:sw});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'kill_rejected'}); }
          return;
        }

        if (url.pathname === '/api/v1/autonomy/cost' && req.method === 'POST') {
          const body=await readJson(req);
          const action=beginAction(req,body,'autonomy.record',url.pathname);
          try {
            const entry=autonomyLedger.record({
              id:body.id??`cost_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              missionId:body.missionId,kind:body.kind,amountCents:body.amountCents,
              evidenceRef:body.evidenceRef??null,source:body.actor,
            });
            completeAction(action.key,{status:'accepted'});
            sendJson(res,201,{version:API_VERSION,entry});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'invalid_cost_entry'}); }
          return;
        }

        if (url.pathname === '/api/v1/autonomy/allowance' && req.method === 'POST') {
          const body=await readJson(req);
          const action=beginAction(req,body,'autonomy.check',url.pathname);
          try {
            if(!body?.missionId)throw Object.assign(new Error('missionId required'),{code:'mission_id_required'});
            if(!Number.isInteger(body?.budgetCents))throw Object.assign(new Error('budgetCents required'),{code:'budget_required'});
            const result=assertAutonomyAllowed({
              killSwitch:killFor(`mission:${body.missionId}`),ledger:autonomyLedger,
              missionId:body.missionId,budgetCents:body.budgetCents,
              policyOk:body.policyOk??true,evidenceRef:body.evidenceRef??null,
            });
            completeAction(action.key,{status:'accepted'});
            sendJson(res,200,{version:API_VERSION,...result});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'allowance_rejected'}); }
          return;
        }

        if (url.pathname === '/api/v1/auth/magic-link' && req.method === 'POST') {
          const body=await readJson(req);
          await rescope(body?.actor);
          const throttle=magicLinkLimiter.hit(req.socket?.remoteAddress || 'unknown');
          if(!throttle.allowed){sendJson(res,429,{error:'rate_limited',retryAfterSec:throttle.retryAfterSec});return;}
          const action=beginAction(req,body,'auth.issue',url.pathname);
          try {
            if(!body?.userId||!getUser(body.userId)){actionGuard.fail(action.key,'unknown user');sendJson(res,404,{error:'user_not_found'});return;}
            const token=issueMagicToken({userId:body.userId,secret});
            completeAction(action.key,{status:'accepted'});
            sendJson(res,201,{version:API_VERSION,token,userId:body.userId});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'token_issue_failed'}); }
          return;
        }

        if (url.pathname === '/api/v1/auth/me' && req.method === 'GET') {
          try {
            const subject=subjectFromAuthHeader(req,{secret});
            if(!subject){sendJson(res,401,{error:'authentication_required'});return;}
            sendJson(res,200,{version:API_VERSION,userId:subject});
          } catch(error){ sendApiError(res,error); }
          return;
        }

        if (url.pathname === '/api/v1/users' && req.method === 'POST') {
          const body=await readJson(req);
          const action=beginAction(req,body,'user.manage',url.pathname);
          try {
            const user=createUser({id:body.id,name:body.name,role:body.role,workspaceId:body.workspaceId,capabilities:body.capabilities});
            completeAction(action.key,{status:'accepted'});
            sendJson(res,201,{version:API_VERSION,user});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'invalid_user'}); }
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/users\/([^/]+)\/capabilities$/);
        if (match && req.method === 'PATCH') {
          const body=await readJson(req);
          const id=decodeURIComponent(match[1]);
          if(!getUser(id)){sendJson(res,404,{error:'user_not_found'});return;}
          const action=beginAction(req,body,'user.manage',url.pathname);
          try {
            const user=updateCapabilities(id,body.capabilities);
            completeAction(action.key,{status:'accepted'});
            sendJson(res,200,{version:API_VERSION,user});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'invalid_capabilities'}); }
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/users\/([^/]+)$/);
        if (match && req.method === 'GET') {
          const user=getUser(decodeURIComponent(match[1]));
          if(!user){sendJson(res,404,{error:'user_not_found'});return;}
          sendJson(res,200,{version:API_VERSION,user});
          return;
        }

        if (url.pathname === '/api/v1/capabilities' && req.method === 'GET') {
          sendJson(res,200,{version:API_VERSION,capabilities:listGrantableCapabilities()});
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/memory\/([^/]+)$/);
        if (match && req.method === 'DELETE') {
          const body=await readJson(req);
          await rescope(body?.actor);
          const id = decodeURIComponent(match[1]);
          if (!store.snapshot().memory.some(m => m.id === id)) { sendJson(res, 404, { error:'memory_not_found' }); return; }
          const action=beginAction(req,body,'memory.revoke',url.pathname);
          try {
            const next = await store.mutate(draft => { draft.memory = draft.memory.filter(m => m.id !== id); return draft; });
            completeAction(action.key,{status:'accepted'});
            broadcast({ state:next, runtimes:runtimeHub.snapshot() });
            sendJson(res, 200, { state:next });
          } catch (error) { failAction(action.key,error); }
          return;
        }

        if (url.pathname === '/api/v1/goals' && req.method === 'POST') {
          const body=await readJson(req);
          await rescope(body?.actor);
          const action=beginAction(req,body,'goal.manage',url.pathname);
          try {
            const goal=createGoal({id:body.id??`goal_${Date.now().toString(36)}`,owner:body.owner,successCriteria:body.successCriteria,budgetCents:body.budgetCents,horizonEnd:body.horizonEnd,parentGoalId:body.parentGoalId});
            if((store.snapshot().goals||[]).some(g=>g.id===goal.id))throw Object.assign(new Error('duplicate goal'),{code:'goal_duplicate_id'});
            await store.mutate(draft=>{draft.goals=[goal,...(draft.goals||[])];return draft;});
            completeAction(action.key,{status:'accepted'});
            sendJson(res,201,{version:API_VERSION,goal});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,/goal_owner|goal_successCriteria|goal_budget|goal_horizon/.test(error?.message||'')?422:(error?.code||'invalid_goal'),{error:error?.code||error?.message||'invalid_goal'}); }
          return;
        }

        if (url.pathname === '/api/v1/goals' && req.method === 'GET') {
          sendJson(res,200,{version:API_VERSION,goals:store.snapshot().goals||[]});
          return;
        }

        if (url.pathname === '/api/v1/lessons' && req.method === 'POST') {
          const body=await readJson(req);
          await rescope(body?.actor);
          const action=beginAction(req,body,'goal.manage',url.pathname);
          try {
            const lesson=createLesson({id:body.id,missionId:body.missionId,verdict:body.verdict,lesson:body.lesson,by:body.by,goalId:body.goalId});
            await store.mutate(draft=>{draft.lessons=[lesson,...(draft.lessons||[])];return draft;});
            completeAction(action.key,{status:'accepted'});
            sendJson(res,201,{version:API_VERSION,lesson});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,/lesson_|goal_owner/.test(error?.message||'')?422:(error?.code||'invalid_lesson'),{error:error?.code||error?.message||'invalid_lesson'}); }
          return;
        }

        if (url.pathname === '/api/v1/lessons' && req.method === 'GET') {
          const verdict=url.searchParams.get('verdict');
          const lessons=(store.snapshot().lessons||[]).filter(l=>!verdict||l.verdict===verdict);
          sendJson(res,200,{version:API_VERSION,lessons});
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/goals\/([^/]+)\/progress$/);
        if (match && req.method === 'GET') {
          const id=decodeURIComponent(match[1]);
          const snapshot=store.snapshot();
          const goal=(snapshot.goals||[]).find(g=>g.id===id);
          if(!goal){sendJson(res,404,{error:'goal_not_found'});return;}
          const linked=(snapshot.missions||[]).filter(m=>m.goalId===id);
          const averageProgress=linked.length?linked.reduce((sum,m)=>sum+(Number(m.progress)||0),0)/linked.length:null;
          const drift=assessGoalDrift({goal,missions:snapshot.missions||[]});
          sendJson(res,200,{version:API_VERSION,goalId:id,linkedMissions:linked.length,averageProgress,drifted:drift.drifted,driftReasons:drift.reasons});
          return;
        }

        match = url.pathname.match(/^\/api\/v1\/missions\/([^/]+)\/goal$/);
        if (match && req.method === 'PATCH') {
          const body=await readJson(req);
          await rescope(body?.actor);
          const id=decodeURIComponent(match[1]);
          const action=beginAction(req,body,'mission.control',url.pathname);
          try {
            const snapshot=store.snapshot();
            if(!(snapshot.goals||[]).some(g=>g.id===body.goalId)){actionGuard.fail(action.key,'unknown goal');sendJson(res,404,{error:'goal_not_found'});return;}
            if(!snapshot.missions.some(m=>m.id===id)){actionGuard.fail(action.key,'unknown mission');sendJson(res,404,{error:'mission_not_found'});return;}
            const next=await store.mutate(draft=>{draft.missions=draft.missions.map(m=>m.id===id?{...m,goalId:body.goalId}:m);return draft;});
            completeAction(action.key,{status:'accepted'});
            broadcast({ state:next, runtimes:runtimeHub.snapshot() });
            sendJson(res,200,{version:API_VERSION,mission:next.missions.find(m=>m.id===id)});
          } catch(error){ actionGuard.fail(action.key,error?.message||error);sendJson(res,422,{error:error?.code||'link_rejected'}); }
          return;
        }

        sendJson(res, 404, { error:'api_not_found' });
      } catch (error) {
        sendApiError(res,error);
      }
      return;
    }

    await serveStatic({rootDir,url,res});
  });

  server.on('close', () => {
    runtimeHub.stopAll();
    for (const hub of hubs.values()) { try { hub.stopAll(); } catch {} }
    sse.closeAll();
  });
  server.workspace = { store, storeFor, runtimeHub, upstreamHub, federation, ready, stores, hubs, bootToken };
  // ponytail: close drains per-user persists first — teardown rmdir otherwise
  // races in-flight stateFile writes (CI ENOTEMPTY flake).
  const rawClose = server.close.bind(server);
  server.close = (callback) => {
    try { runtimeHub.stopAll(); } catch {}
    for (const hub of hubs.values()) { try { hub.stopAll(); } catch {} }
    Promise.all([...stores.values()].map(entry => entry.drain())).then(
      () => rawClose(callback),
      () => rawClose(callback),
    );
    return server;
  };
  return server;
}

