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

export function createAppServer({ root, stateFile, runtimeIntervalMs = 1250, upstreamConfig = null, federation = null, fixtures = true } = {}) {
  const rootDir = resolveRoot(root);
  const store = new WorkspaceStateStore({ stateFile, initialState: createInitialState({ fixtures }) });
  const upstreamHub=createUpstreamHub(upstreamConfig || upstreamConfigFromEnv());
  const sse=createSSEBroker({version:API_VERSION});
  const federationHandler=federation?.kernel?createFederationApiHandler(federation):null;
  const broadcast=payload=>sse.broadcast(payload);
  const ready = store.init();
  const actionGuard=createActionGuard();
  const beginAction=(req,body,capability,path,confirmation=false)=>{
    const snapshot=store.snapshot();
    if(!body?.actor) { const error=new Error('actor required');error.code='actor_required';error.status=422;throw error; }
    try { assertActorCapability({state:snapshot,actor:body.actor,capability}); }
    catch (error) { error.code='forbidden';error.status=403;throw error; }
    if(confirmation) { try { requireResetConfirmation(body.confirmationToken); } catch(error) { error.code='confirmation_required';error.status=422;throw error; } }
    const key=req.headers['idempotency-key']||body.idempotencyKey;
    if(!key) { const error=new Error('idempotency key required');error.code='idempotency_conflict';error.status=422;throw error; }
    try { return { key:`${req.method}:${path}:${key}`, state:actionGuard.begin(`${req.method}:${path}:${key}`) }; }
    catch(error) { error.code='idempotency_conflict';error.status=409;throw error; }
  };
  const completeAction=(key,result)=>actionGuard.complete(key,result);
  const failAction=(key,error)=>{actionGuard.fail(key,error?.message||error);throw error;};
  const syncLog=createServerLog();
  const runtimeHub = new MissionRuntimeHub({
    store,
    intervalMs:runtimeIntervalMs,
    onChange:payload => broadcast(payload),
  });

  const server = http.createServer(async (req, res) => {
    await ready;
    const url = new URL(req.url || '/', 'http://127.0.0.1');

    if (url.pathname === '/healthz') {
      sendJson(res, 200, { status:'ok', app:'aftergraph-workspace-v5-reference', api:API_VERSION });
      return;
    }

    if (url.pathname === '/api/v1/events' && req.method === 'GET') {
      sse.attach(req,res,{state:store.snapshot(),runtimes:runtimeHub.snapshot()});
      return;
    }

    if (isApiRequest(url)) {
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

        match = url.pathname.match(/^\/api\/v1\/memory\/([^/]+)$/);
        if (match && req.method === 'DELETE') {
          const body=await readJson(req);
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
    sse.closeAll();
  });
  server.workspace = { store, runtimeHub, upstreamHub, federation, ready };
  return server;
}

