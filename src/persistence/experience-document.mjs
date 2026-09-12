import { createProjectRecord, createRecentEntry } from '../workspace/project-recents.mjs';

const TOP_FIELDS = new Set([
  'tenantId','projects','recents','layout','surfaces',
  'preferences','activeProjectId','presentation',
]);
const PROJECT_FIELDS = new Set([
  'schema','owner','id','tenantId','name','description',
  'pinned','refs','createdAt','updatedAt',
]);
const RECENT_FIELDS = new Set([
  'schema','owner','id','tenantId','label','kind',
  'targetRef','projectId','updatedAt',
]);
const SURFACE_FIELDS = new Set([
  'id','tenantId','kind','targetRef','presentation','updatedAt',
]);
const REF_FIELDS = new Set(['owner','type','id','ref','tenantId']);

const FORBIDDEN = new Set([
  'conversations','missions','approvals','agents','memory',
  'authority','execution','verification','threads','turns','thread',
  'credentials','secrets','runtimeThread','runtimeTurn',
]);

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required`);
  }
  return value;
}

function rejectUnknown(input, allowed, scope = 'experience') {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error(`${scope} must be an object`);
  }
  for (const key of Object.keys(input)) {
    if (!allowed.has(key)) throw new Error(`unsupported canonical field in ${scope}: ${key}`);
  }
}

function freezePresentation(value, path = 'presentation') {
  if (value === null || ['string','number','boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map((item,i)=>freezePresentation(item,`${path}[${i}]`)));
  if (typeof value !== 'object') throw new Error(`${path} contains unsupported value`);
  const out = {};
  for (const [key,item] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) throw new Error(`forbidden ${key} field in ${path}`);
    out[key] = freezePresentation(item, `${path}.${key}`);
  }
  return Object.freeze(out);
}

function normalizeRef(input, tenantId) {
  rejectUnknown(input, REF_FIELDS, 'canonical ref');
  if (input.tenantId !== undefined && input.tenantId !== tenantId) {
    throw new Error('cross-tenant canonical ref rejected');
  }
  return Object.freeze({
    owner: requiredString(input.owner,'ref.owner'),
    type: requiredString(input.type,'ref.type'),
    id: requiredString(input.id,'ref.id'),
    ref: requiredString(input.ref,'ref.ref'),
    ...(input.tenantId ? {tenantId:input.tenantId} : {}),
  });
}

function normalizeProject(input, tenantId) {
  rejectUnknown(input, PROJECT_FIELDS, 'project');
  if (input.owner !== undefined && input.owner !== 'studio') throw new Error('project owner must be studio');
  if (input.schema !== undefined && input.schema !== 'aftergraph.project-experience/1.0') throw new Error('unsupported project schema');
  if (input.tenantId !== tenantId) throw new Error('cross-tenant project rejected');
  return createProjectRecord({
    id:input.id, tenantId, name:input.name, description:input.description,
    pinned:input.pinned, refs:(input.refs ?? []).map(ref=>({...ref})),
    createdAt:input.createdAt, updatedAt:input.updatedAt,
  });
}

function normalizeRecent(input, tenantId) {
  rejectUnknown(input, RECENT_FIELDS, 'recent');
  if (input.owner !== undefined && input.owner !== 'studio') throw new Error('recent owner must be studio');
  if (input.schema !== undefined && input.schema !== 'aftergraph.recent-experience/1.0') throw new Error('unsupported recent schema');
  if (input.tenantId !== tenantId) throw new Error('cross-tenant recent rejected');
  return createRecentEntry({
    id:input.id, tenantId, label:input.label, kind:input.kind,
    targetRef:{...input.targetRef}, projectId:input.projectId, updatedAt:input.updatedAt,
  });
}

function normalizeSurface(input, tenantId) {
  rejectUnknown(input, SURFACE_FIELDS, 'surface');
  if (input.tenantId !== undefined && input.tenantId !== tenantId) {
    throw new Error('cross-tenant surface rejected');
  }
  const target = input.targetRef ? normalizeRef(input.targetRef,tenantId) : null;
  const presentation = freezePresentation(input.presentation ?? {}, 'surface.presentation');
  const result = {
    id: requiredString(input.id,'surface.id'),
    tenantId,
    kind: requiredString(input.kind,'surface.kind'),
    presentation,
  };
  if (target) result.targetRef = target;
  if (input.updatedAt) result.updatedAt = String(input.updatedAt);
  return Object.freeze(result);
}

export function createExperienceDocument(input = {}) {
  rejectUnknown(input, TOP_FIELDS);
  const tenantId = requiredString(input.tenantId,'tenantId');
  const projects = Object.freeze((input.projects ?? []).map(item=>normalizeProject(item,tenantId)));
  const recents = Object.freeze((input.recents ?? []).map(item=>normalizeRecent(item,tenantId)));
  const surfaces = Object.freeze((input.surfaces ?? []).map(item=>normalizeSurface(item,tenantId)));
  const layout = freezePresentation(input.layout ?? {},'layout');
  const preferences = freezePresentation(input.preferences ?? {},'preferences');
  const presentation = freezePresentation(input.presentation ?? {},'presentation');
  return Object.freeze({
    schema:'aftergraph.studio-experience/1.0',
    owner:'studio', tenantId, projects, recents, layout, surfaces,
    preferences, presentation,
    activeProjectId:input.activeProjectId ? String(input.activeProjectId) : null,
  });
}
