import {
  type AgentConversation,
  type AgentConversationListResponse,
  type AgentConversationMessage,
  type AgentConversationSummary,
  type AgentSkillDetail,
  type AgentSkillFile,
  type AgentSkillListResponse,
  GENERATION_COUNTS,
  type GalleryExportRequest,
  IMAGE_MODEL,
  IMAGE_QUALITIES,
  OUTPUT_FORMATS,
  type PromptFavoriteGroup,
  type PromptFavoriteItem,
  type PromptFavoritesResponse,
  type PromptPoolAuthor,
  type PromptPoolItem,
  type PromptPoolMediaType,
  type PromptPoolResponse,
  type PromptPoolStats,
  type PromptPoolSummary,
  SIZE_PRESETS,
  STYLE_PRESETS,
  type AppConfig,
  type AuthStatusResponse,
  type CodexDevicePollResponse,
  type CodexLogoutResponse,
  type EditImageRequest,
  type GenerateImageRequest,
  type GenerationOutput,
  type GenerationRecord,
  type GenerationResponse,
  type GalleryResponse,
  type GeneratedAsset,
  type ProjectState,
  type ProviderConfigResponse,
  PROVIDER_SOURCE_IDS,
  type ProviderSourceId,
  type ProviderSourceSummary,
  type ProviderSourceView,
  type SaveAgentConversationRequest,
  type SaveAgentSkillRequest,
  type SaveAgentLlmConfigRequest,
  type SaveProviderConfigRequest,
  type SaveStorageConfigRequest,
  type StorageConfigResponse,
  type StorageTestResult,
  type AgentLlmConfigView
} from "@gpt-image-canvas/shared";

const LOCALE_STORAGE_KEY = "gpt-image-canvas.locale";
const W3KITS_PLUGIN_ID = "gpt-image-canvas";
const W3KITS_BRIDGE_VERSION = 1;
const W3KITS_RESPONSE = "W3KITS_RESPONSE";
const W3KITS_AUTH_REQUIRED = "W3KITS_AUTH_REQUIRED";
const W3KITS_RUNTIME_SESSION_REQUEST = "W3KITS_RUNTIME_SESSION_REQUEST";
const W3KITS_PROJECT_KEY = "gpt-image-canvas.w3kits.project";
const W3KITS_PROVIDER_CONFIG_KEY = "gpt-image-canvas.w3kits.provider-config";
const W3KITS_STORAGE_CONFIG_KEY = "gpt-image-canvas.w3kits.storage-config";
const W3KITS_AGENT_CONFIG_KEY = "gpt-image-canvas.w3kits.agent-config";
const W3KITS_AUTH_STATUS_KEY = "gpt-image-canvas.w3kits.auth-status";
const W3KITS_PROMPT_FAVORITES_KEY = "gpt-image-canvas.w3kits.prompt-favorites";
const W3KITS_AGENT_SKILLS_KEY = "gpt-image-canvas.w3kits.agent-skills";
const W3KITS_AGENT_CONVERSATIONS_KEY = "gpt-image-canvas.w3kits.agent-conversations";
const W3KITS_PROJECT_PATH = "state/project.json";
const W3KITS_PROVIDER_CONFIG_PATH = "state/provider-config.json";
const W3KITS_STORAGE_CONFIG_PATH = "state/storage-config.json";
const W3KITS_AGENT_CONFIG_PATH = "state/agent-config.json";
const W3KITS_AUTH_STATUS_PATH = "state/auth-status.json";
const W3KITS_PROMPT_FAVORITES_PATH = "state/prompt-favorites.json";
const W3KITS_AGENT_SKILLS_PATH = "state/agent-skills.json";
const W3KITS_AGENT_CONVERSATIONS_PATH = "state/agent-conversations.json";
const W3KITS_ASSET_DIR = "assets";
const W3KITS_PROMPT_POOL_BUNDLE_PATH = "/__w3kits/prompt-pool/prompts-all.json";
const W3KITS_PROMPT_POOL_SUMMARY_PATH = "/__w3kits/prompt-pool/summary.json";
const MAX_OPENAI_IMAGE_BYTES = 50 * 1024 * 1024;

type Locale = "zh-CN" | "en";

interface JsonStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface RuntimeLike {
  fetch: typeof fetch;
  location: Pick<Location, "href" | "origin" | "search">;
  localStorage: JsonStorage;
  navigator?: Pick<Navigator, "language" | "languages">;
  document?: Pick<Document, "documentElement">;
}

interface W3KitsRuntimeState {
  project: ProjectState;
  providerConfig: ProviderConfigResponse;
  storageConfig: StorageConfigResponse;
  agentConfig: AgentLlmConfigView;
  authStatus: AuthStatusResponse;
  promptFavorites: PromptFavoritesResponse;
  agentSkills: AgentSkillDetail[];
  agentConversations: AgentConversation[];
}

interface BridgeErrorShape {
  code?: unknown;
  message?: unknown;
}

interface BridgeResponse<T> {
  type?: unknown;
  requestId?: unknown;
  ok?: unknown;
  data?: T;
  error?: BridgeErrorShape;
}

interface StorageReadResult {
  body?: string;
}

interface StorageBinaryReadResult {
  body: Uint8Array;
  contentType?: string;
}

interface W3KitsObjectFacadeStorage {
  type: "w3kits-vfs-object-facade";
  endpoint: string;
  bucket: string;
  visibleConfigDir?: string;
  auth?: { mode?: string; header?: string };
}

interface W3KitsRuntimeSession {
  token: string;
  expiresIn: number;
  pluginId: string;
  pluginVersion: string;
  packageName?: string;
  packageIntegrity?: string;
  openaiBaseUrl: string;
  runtimeSessionHeader: string;
  identityHeaders: Record<string, string | undefined>;
  storage?: W3KitsObjectFacadeStorage;
}

interface StoredAssetRecord {
  id: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  dataUrl?: string;
  bodyKey?: string;
  bodyEncoding?: "base64";
  size?: number;
  createdAt: string;
}

interface PromptFavoriteStateEnvelope extends PromptFavoritesResponse {}

interface BuiltInAgentSkillDefinition {
  slug: string;
  name: string;
  description: string;
  version?: string;
  source?: string;
  enabled: boolean;
  required: boolean;
  triggerMode: "always" | "auto";
  triggerKeywords: string[];
  files: AgentSkillFile[];
}

const fallbackInstalledFlag = Symbol.for("gpt-image-canvas.w3kits-fallback-installed");
let cachedRuntimeSession: { value: W3KitsRuntimeSession; expiresAt: number } | null = null;
let cachedPromptPoolResponse: PromptPoolResponse | null = null;
const STATE_CACHE_TTL_MS = 1500;
const ASSET_RECORD_CACHE_TTL_MS = 60 * 60 * 1000;
const ASSET_BODY_DB_NAME = "gpt-image-canvas-assets";
const ASSET_BODY_DB_VERSION = 1;
const ASSET_BODY_STORE = "assetBodies";
const ASSET_RECORD_STORE = "assetRecords";
const stateCache = new Map<string, { value: unknown; expiresAt: number }>();
const stateInflight = new Map<string, Promise<unknown>>();
const assetRecordCache = new Map<string, { record: StoredAssetRecord; expiresAt: number }>();
const assetBodyCache = new Map<string, { body: Uint8Array; expiresAt: number }>();

function stateCacheKey(key: string, path: string): string {
  return `${key}:${path}`;
}

function readStateCache<T>(key: string, path: string): T | undefined {
  const entry = stateCache.get(stateCacheKey(key, path));
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    stateCache.delete(stateCacheKey(key, path));
    return undefined;
  }
  return entry.value as T;
}

function writeStateCache(key: string, path: string, value: unknown): void {
  stateCache.set(stateCacheKey(key, path), { value, expiresAt: Date.now() + STATE_CACHE_TTL_MS });
}

function writeAssetRecordCache(record: StoredAssetRecord, body?: Uint8Array): void {
  assetRecordCache.set(record.id, { record, expiresAt: Date.now() + ASSET_RECORD_CACHE_TTL_MS });
  if (body) {
    assetBodyCache.set(record.id, { body, expiresAt: Date.now() + ASSET_RECORD_CACHE_TTL_MS });
  }
}

function readAssetRecordCache(assetId: string): StoredAssetRecord | null {
  const entry = assetRecordCache.get(assetId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    assetRecordCache.delete(assetId);
    return null;
  }
  return entry.record;
}

function readAssetBodyCache(assetId: string): Uint8Array | null {
  const entry = assetBodyCache.get(assetId);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    assetBodyCache.delete(assetId);
    return null;
  }
  return entry.body;
}

function deleteAssetRecordCache(assetId: string): void {
  assetRecordCache.delete(assetId);
  assetBodyCache.delete(assetId);
}

function indexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

async function openAssetBodyDb(): Promise<IDBDatabase | null> {
  if (!indexedDbAvailable()) return null;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(ASSET_BODY_DB_NAME, ASSET_BODY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ASSET_BODY_STORE)) db.createObjectStore(ASSET_BODY_STORE, { keyPath: "assetId" });
      if (!db.objectStoreNames.contains(ASSET_RECORD_STORE)) db.createObjectStore(ASSET_RECORD_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("asset_body_db_open_failed"));
    request.onblocked = () => reject(new Error("asset_body_db_open_blocked"));
  });
}

async function writeAssetRecordL1(record: StoredAssetRecord): Promise<void> {
  const db = await openAssetBodyDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ASSET_RECORD_STORE, "readwrite");
      transaction.objectStore(ASSET_RECORD_STORE).put(record);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("asset_record_db_write_failed"));
      transaction.onabort = () => reject(transaction.error || new Error("asset_record_db_write_aborted"));
    });
  } finally {
    db.close();
  }
}

async function readAssetRecordL1(assetId: string): Promise<StoredAssetRecord | null> {
  const db = await openAssetBodyDb();
  if (!db) return null;
  try {
    return await new Promise<StoredAssetRecord | null>((resolve, reject) => {
      const transaction = db.transaction(ASSET_RECORD_STORE, "readonly");
      const request = transaction.objectStore(ASSET_RECORD_STORE).get(assetId) as IDBRequest<StoredAssetRecord | undefined>;
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || new Error("asset_record_db_read_failed"));
    });
  } finally {
    db.close();
  }
}

async function deleteAssetRecordL1(assetId: string): Promise<void> {
  const db = await openAssetBodyDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ASSET_RECORD_STORE, "readwrite");
      transaction.objectStore(ASSET_RECORD_STORE).delete(assetId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("asset_record_db_delete_failed"));
      transaction.onabort = () => reject(transaction.error || new Error("asset_record_db_delete_aborted"));
    });
  } finally {
    db.close();
  }
}

async function writeAssetBodyL1(assetId: string, body: Uint8Array, contentType: string): Promise<void> {
  const db = await openAssetBodyDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ASSET_BODY_STORE, "readwrite");
      transaction.objectStore(ASSET_BODY_STORE).put({
        assetId,
        body: bytesToArrayBuffer(body),
        contentType,
        updatedAt: new Date().toISOString(),
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("asset_body_db_write_failed"));
      transaction.onabort = () => reject(transaction.error || new Error("asset_body_db_write_aborted"));
    });
  } finally {
    db.close();
  }
}

async function readAssetBodyL1(assetId: string): Promise<Uint8Array | null> {
  const db = await openAssetBodyDb();
  if (!db) return null;
  try {
    return await new Promise<Uint8Array | null>((resolve, reject) => {
      const transaction = db.transaction(ASSET_BODY_STORE, "readonly");
      const request = transaction.objectStore(ASSET_BODY_STORE).get(assetId) as IDBRequest<{ body?: ArrayBuffer } | undefined>;
      request.onsuccess = () => resolve(request.result?.body ? new Uint8Array(request.result.body) : null);
      request.onerror = () => reject(request.error || new Error("asset_body_db_read_failed"));
    });
  } finally {
    db.close();
  }
}

async function deleteAssetBodyL1(assetId: string): Promise<void> {
  const db = await openAssetBodyDb();
  if (!db) return;
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(ASSET_BODY_STORE, "readwrite");
      transaction.objectStore(ASSET_BODY_STORE).delete(assetId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("asset_body_db_delete_failed"));
      transaction.onabort = () => reject(transaction.error || new Error("asset_body_db_delete_aborted"));
    });
  } finally {
    db.close();
  }
}


export function bootstrapW3KitsRuntime(runtime: RuntimeLike): Locale {
  const locale = bootstrapLocale(runtime);
  installW3KitsFetchFallback(runtime);
  return locale;
}

export function bootstrapLocale(runtime: Pick<RuntimeLike, "document" | "location" | "localStorage" | "navigator">): Locale {
  const search = new URLSearchParams(runtime.location.search);
  const queryLocale = normalizeLocale(search.get("w3kitsLocale"));
  const storedLocale = normalizeLocale(runtime.localStorage.getItem(LOCALE_STORAGE_KEY));
  const inferredLocale = inferLocale(runtime.navigator);
  const locale = queryLocale ?? storedLocale ?? inferredLocale ?? "en";

  runtime.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  if (runtime.document) {
    runtime.document.documentElement.lang = locale;
  }

  return locale;
}

export function installW3KitsFetchFallback(runtime: RuntimeLike): void {
  const target = runtime as RuntimeLike & { [fallbackInstalledFlag]?: boolean };
  if (target[fallbackInstalledFlag]) {
    return;
  }

  target[fallbackInstalledFlag] = true;
  const nativeFetch = runtime.fetch.bind(runtime);

  const patchedFetch: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    if (!shouldInterceptApiRequest(request)) {
      return nativeFetch(input, init);
    }

    if (shouldHandleInW3KitsRuntime(request)) {
      const runtimeResponse = await handleW3KitsApiRequest(request, runtime);
      if (runtimeResponse) {
        return runtimeResponse;
      }
    }

    try {
      const response = await nativeFetch(input, init);
      if (shouldUseFallbackResponse(request, response)) {
        const fallbackResponse = await handleW3KitsApiRequest(request, runtime);
        return fallbackResponse ?? response;
      }

      return response;
    } catch {
      const fallbackResponse = await handleW3KitsApiRequest(request, runtime);
      if (fallbackResponse) {
        return fallbackResponse;
      }

      throw new Error(`Failed to call ${request.method} ${new URL(request.url, runtime.location.href).pathname}`);
    }
  };

  runtime.fetch = patchedFetch;
  if (typeof globalThis !== "undefined" && globalThis.fetch !== patchedFetch) {
    globalThis.fetch = patchedFetch;
  }
}

export async function handleW3KitsApiRequest(request: Request, runtime: RuntimeLike): Promise<Response | undefined> {
  const url = new URL(request.url, runtime.location.href);
  if (!url.pathname.startsWith("/api/")) {
    return undefined;
  }

  const method = request.method.toUpperCase();
  const generationId = readPathParam(url.pathname, "/api/generations/");
  const galleryOutputId = readPathParam(url.pathname, "/api/gallery/");

  switch (`${method} ${url.pathname}`) {
    case "GET /api/health":
      return jsonResponse({ status: "ok", runtime: "w3kits-cache" });
    case "GET /api/config":
      return jsonResponse(buildAppConfig());
    case "GET /api/project":
      return jsonResponse(await readProjectState(runtime));
    case "GET /api/provider-config":
      return jsonResponse(await readProviderConfigState(runtime));
    case "GET /api/storage/config":
      return jsonResponse(await readStorageConfigState(runtime));
    case "GET /api/agent-config":
      return jsonResponse(await readAgentConfigState(runtime));
    case "GET /api/auth/status":
      return jsonResponse(await readAuthStatusState(runtime));
    case "GET /api/pool":
      return jsonResponse(await loadPromptPoolResponse(runtime));
    default:
      break;
  }

  const state = await readState(runtime);

  switch (`${method} ${url.pathname}`) {
    case "GET /api/health":
      return jsonResponse({ status: "ok", runtime: "w3kits-cache" });
    case "GET /api/config":
      return jsonResponse(buildAppConfig());
    case "PUT /api/project": {
      const body = await readJsonBody<{ name?: string; snapshot?: unknown }>(request);
      if (!body || !Object.hasOwn(body, "snapshot")) {
        return jsonError(400, "invalid_project", "Project payload must include a snapshot.");
      }

      const nextProject = saveProjectState(state.project, body);
      await writeJsonState(runtime, W3KITS_PROJECT_KEY, W3KITS_PROJECT_PATH, nextProject);
      return jsonResponse(nextProject);
    }
    case "PUT /api/provider-config": {
      const body = await readJsonBody<SaveProviderConfigRequest>(request);
      if (!body) {
        return jsonError(400, "invalid_json", "The request body must be valid JSON.");
      }

      const nextProviderConfig = saveProviderConfigState(state.providerConfig, body);
      const nextAuthStatus = buildAuthStatus(nextProviderConfig, state.agentConfig);
      await writeJsonState(runtime, W3KITS_PROVIDER_CONFIG_KEY, W3KITS_PROVIDER_CONFIG_PATH, nextProviderConfig, { sync: false });
      await writeJsonState(runtime, W3KITS_AUTH_STATUS_KEY, W3KITS_AUTH_STATUS_PATH, nextAuthStatus, { sync: false });
      return jsonResponse(nextProviderConfig);
    }
    case "PUT /api/storage/config": {
      const body = await readJsonBody<SaveStorageConfigRequest>(request);
      if (!body) {
        return jsonError(400, "invalid_json", "The request body must be valid JSON.");
      }

      const nextStorageConfig = saveStorageConfigState(state.storageConfig, body);
      await writeJsonState(runtime, W3KITS_STORAGE_CONFIG_KEY, W3KITS_STORAGE_CONFIG_PATH, nextStorageConfig);
      return jsonResponse(nextStorageConfig);
    }
    case "POST /api/storage/config/test":
      return jsonResponse({ ok: true, message: "Plugin cache storage is available." } satisfies StorageTestResult);
    case "PUT /api/agent-config": {
      const body = await readJsonBody<SaveAgentLlmConfigRequest>(request);
      if (!body) {
        return jsonError(400, "invalid_json", "The request body must be valid JSON.");
      }

      const nextAgentConfig = saveAgentConfigState(state.agentConfig, body);
      const nextAuthStatus = buildAuthStatus(state.providerConfig, nextAgentConfig);
      await writeJsonState(runtime, W3KITS_AGENT_CONFIG_KEY, W3KITS_AGENT_CONFIG_PATH, nextAgentConfig, { sync: false });
      await writeJsonState(runtime, W3KITS_AUTH_STATUS_KEY, W3KITS_AUTH_STATUS_PATH, nextAuthStatus, { sync: false });
      return jsonResponse(nextAgentConfig);
    }
    case "POST /api/auth/codex/logout": {
      const nextAuth = buildAuthStatus(state.providerConfig, state.agentConfig);
      await writeJsonState(runtime, W3KITS_AUTH_STATUS_KEY, W3KITS_AUTH_STATUS_PATH, nextAuth, { sync: false });
      return jsonResponse({ ok: true, auth: nextAuth } satisfies CodexLogoutResponse);
    }
    case "POST /api/auth/codex/device/start":
      return jsonError(501, "unsupported_provider_behavior", "Codex login is not available in the plugin cache fallback.");
    case "POST /api/auth/codex/device/poll":
      return jsonResponse({ status: "denied", message: "Codex login is not available in the plugin cache fallback." } satisfies CodexDevicePollResponse);
    case "GET /api/gallery":
      return jsonResponse(buildGalleryResponse(state.project));
    case "GET /api/pool":
      return jsonResponse(await loadPromptPoolResponse(runtime));
    case "GET /api/prompt-favorites":
      return jsonResponse(state.promptFavorites);
    case "POST /api/prompt-favorites": {
      const body = await readJsonBody<{ promptPoolItemId?: string; groupId?: string }>(request);
      const promptPoolItemId = typeof body?.promptPoolItemId === "string" ? body.promptPoolItemId.trim() : "";
      const groupId = typeof body?.groupId === "string" ? body.groupId.trim() : undefined;
      if (!promptPoolItemId) {
        return jsonError(400, "invalid_prompt_favorite", "Prompt pool item id is required.");
      }

      const promptPool = await loadPromptPoolResponse(runtime);
      const item = promptPool.items.find((entry) => entry.id === promptPoolItemId);
      if (!item) {
        return jsonError(404, "prompt_pool_missing", "Prompt pool item was not found.");
      }

      const nextState = createPromptFavoriteState(state.promptFavorites, item, groupId);
      await writeJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, nextState.state);
      return jsonResponse({ favorite: nextState.favorite }, { status: 201 });
    }
    case "POST /api/prompt-favorite-groups": {
      const body = await readJsonBody<{ name?: string }>(request);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) {
        return jsonError(400, "invalid_prompt_favorite_group", "Favorite group name is required.");
      }

      const nextState = createPromptFavoriteGroupState(state.promptFavorites, name);
      await writeJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, nextState.state);
      return jsonResponse({ group: nextState.group }, { status: 201 });
    }
    case "GET /api/agent-skills":
      return jsonResponse({ skills: summarizeAgentSkills(state.agentSkills) } satisfies AgentSkillListResponse);
    case "POST /api/agent-skills": {
      const body = await readJsonBody<SaveAgentSkillRequest>(request);
      if (!body) {
        return jsonError(400, "invalid_agent_skill", "Agent skill payload must be valid JSON.");
      }

      try {
        const nextState = createAgentSkillState(state.agentSkills, body);
        await writeJsonState(runtime, W3KITS_AGENT_SKILLS_KEY, W3KITS_AGENT_SKILLS_PATH, nextState.skills);
        return jsonResponse({ skill: nextState.skill }, { status: 201 });
      } catch (error) {
        return jsonError(400, "invalid_agent_skill", error instanceof Error ? error.message : "Agent skill could not be created.");
      }
    }
    case "POST /api/agent-skills/import": {
      try {
        const skill = await importAgentSkillState(request, state.agentSkills);
        const skills = upsertAgentSkill(state.agentSkills, skill);
        await writeJsonState(runtime, W3KITS_AGENT_SKILLS_KEY, W3KITS_AGENT_SKILLS_PATH, skills);
        return jsonResponse({ skill }, { status: 201 });
      } catch (error) {
        return jsonError(400, "agent_skill_import_failed", error instanceof Error ? error.message : "Agent skill import failed.");
      }
    }
    case "GET /api/agent-conversations":
      return jsonResponse({ conversations: summarizeAgentConversations(state.agentConversations) } satisfies AgentConversationListResponse);
    case "POST /api/gallery/export": {
      const body = await readJsonBody<GalleryExportRequest>(request);
      if (!body || !Array.isArray(body.outputIds)) {
        return jsonError(400, "invalid_gallery_export_request", "Gallery export requires output ids.");
      }

      const archive = await buildGalleryArchiveResponse(runtime, state.project, body.outputIds);
      return archive;
    }
    case "POST /api/images/generate":
      return handleGenerateImageRequest(runtime, state, request, "generate");
    case "POST /api/images/edit":
      return handleGenerateImageRequest(runtime, state, request, "edit");
    default:
      break;
  }

  if (method === "GET" && generationId) {
    const record = state.project.history.find((item) => item.id === generationId);
    return record ? jsonResponse({ record }) : jsonError(404, "not_found", "Generation record not found.");
  }

  if (method === "POST" && url.pathname.endsWith("/cancel") && generationId) {
    const nextProject = cancelGenerationRecord(state.project, generationId);
    if (nextProject === state.project) {
      return jsonError(404, "not_found", "Generation record not found.");
    }

    await writeJsonState(runtime, W3KITS_PROJECT_KEY, W3KITS_PROJECT_PATH, nextProject);
    return jsonResponse({ record: nextProject.history.find((item) => item.id === generationId) });
  }

  if (method === "DELETE" && galleryOutputId) {
    const deletedAssetIds = assetIdsForGalleryOutput(state.project, galleryOutputId);
    const nextProject = deleteGalleryOutput(state.project, galleryOutputId);
    if (nextProject === state.project) {
      return jsonError(404, "not_found", "Gallery image record not found.");
    }

    await writeJsonState(runtime, W3KITS_PROJECT_KEY, W3KITS_PROJECT_PATH, nextProject);
    await Promise.all(deletedAssetIds.map((assetId) => deleteStoredAssetRecord(runtime, assetId)));
    return jsonResponse({ ok: true });
  }

  const promptFavoriteId = readPathParam(url.pathname, "/api/prompt-favorites/");
  if (promptFavoriteId) {
    if (method === "PATCH" && !url.pathname.endsWith("/use")) {
      const body = await readJsonBody<{ groupId?: string }>(request);
      const groupId = typeof body?.groupId === "string" ? body.groupId.trim() : "";
      if (!groupId) {
        return jsonError(400, "invalid_prompt_favorite", "Favorite group id is required.");
      }

      const nextState = updatePromptFavoriteState(state.promptFavorites, promptFavoriteId, groupId);
      if (!nextState) {
        return jsonError(404, "prompt_favorite_not_found", "Prompt favorite was not found.");
      }

      await writeJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, nextState.state);
      return jsonResponse({ favorite: nextState.favorite });
    }

    if (method === "DELETE") {
      const nextState = deletePromptFavoriteState(state.promptFavorites, promptFavoriteId);
      if (!nextState) {
        return jsonError(404, "prompt_favorite_not_found", "Prompt favorite was not found.");
      }

      await writeJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, nextState.state);
      return jsonResponse({ ok: true });
    }

    if (method === "POST" && url.pathname.endsWith("/use")) {
      const nextState = markPromptFavoriteUsedState(state.promptFavorites, promptFavoriteId);
      if (!nextState) {
        return jsonError(404, "prompt_favorite_not_found", "Prompt favorite was not found.");
      }

      await writeJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, nextState.state);
      return jsonResponse({ favorite: nextState.favorite });
    }
  }

  const promptFavoriteGroupId = readPathParam(url.pathname, "/api/prompt-favorite-groups/");
  if (promptFavoriteGroupId) {
    if (method === "PATCH") {
      const body = await readJsonBody<{ name?: string }>(request);
      const name = typeof body?.name === "string" ? body.name.trim() : "";
      if (!name) {
        return jsonError(400, "invalid_prompt_favorite_group", "Favorite group name is required.");
      }

      const nextState = updatePromptFavoriteGroupState(state.promptFavorites, promptFavoriteGroupId, name);
      if (!nextState) {
        return jsonError(404, "prompt_favorite_group_not_found", "Favorite group was not found.");
      }

      await writeJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, nextState.state);
      return jsonResponse({ group: nextState.group });
    }

    if (method === "DELETE") {
      const nextState = deletePromptFavoriteGroupState(state.promptFavorites, promptFavoriteGroupId);
      if (!nextState) {
        return jsonError(404, "prompt_favorite_group_not_found", "Favorite group was not found.");
      }

      await writeJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, nextState.state);
      return jsonResponse({ ok: true });
    }
  }

  const agentSkillId = readPathParam(url.pathname, "/api/agent-skills/");
  if (agentSkillId && !url.pathname.endsWith("/import")) {
    if (method === "GET") {
      const skill = findAgentSkill(state.agentSkills, agentSkillId);
      return skill ? jsonResponse({ skill }) : jsonError(404, "agent_skill_not_found", "Agent skill was not found.");
    }

    if (method === "PUT") {
      const body = await readJsonBody<SaveAgentSkillRequest>(request);
      if (!body) {
        return jsonError(400, "invalid_agent_skill", "Agent skill payload must be valid JSON.");
      }

      try {
        const nextState = saveAgentSkillState(state.agentSkills, agentSkillId, body);
        await writeJsonState(runtime, W3KITS_AGENT_SKILLS_KEY, W3KITS_AGENT_SKILLS_PATH, nextState.skills);
        return jsonResponse({ skill: nextState.skill });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Agent skill could not be saved.";
        const code = message.toLowerCase().includes("not found") ? "agent_skill_not_found" : "invalid_agent_skill";
        const status = code === "agent_skill_not_found" ? 404 : 400;
        return jsonError(status, code, message);
      }
    }
  }

  const conversationId = readPathParam(url.pathname, "/api/agent-conversations/");
  if (conversationId) {
    if (method === "GET") {
      const conversation = state.agentConversations.find((item) => item.id === conversationId);
      return conversation ? jsonResponse(conversation) : jsonError(404, "not_found", "Agent conversation not found.");
    }

    if (method === "PUT") {
      const body = await readJsonBody<SaveAgentConversationRequest>(request);
      if (!body || !Array.isArray(body.messages)) {
        return jsonError(400, "invalid_agent_conversation", "Agent conversation payload must include messages.");
      }

      const conversation = saveAgentConversationState(state.agentConversations, conversationId, body);
      await writeJsonState(runtime, W3KITS_AGENT_CONVERSATIONS_KEY, W3KITS_AGENT_CONVERSATIONS_PATH, upsertAgentConversation(state.agentConversations, conversation));
      return jsonResponse({ conversation });
    }
  }

  if (method === "GET" && url.pathname.startsWith("/api/assets/")) {
    const assetId = readPathParam(url.pathname, "/api/assets/");
    if (!assetId) {
      return jsonError(404, "not_found", "Asset not found.");
    }

    const assetRecord = await readStoredAssetRecord(runtime, assetId);
    if (!assetRecord) {
      return jsonError(404, "not_found", "Asset not found.");
    }

    if (url.pathname.endsWith("/metadata")) {
      return jsonResponse({
        id: assetRecord.id,
        width: assetRecord.width,
        height: assetRecord.height
      });
    }

    const body = await readStoredAssetBody(runtime, assetRecord);
    const isDownload = url.pathname.endsWith("/download");
    return new Response(bytesToArrayBuffer(body), {
      status: 200,
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": `${isDownload ? "attachment" : "inline"}; filename="${assetRecord.fileName}"`,
        "Content-Type": assetRecord.mimeType
      }
    });
  }

  return undefined;
}

export function buildAppConfig(): AppConfig {
  return {
    model: IMAGE_MODEL,
    models: [IMAGE_MODEL],
    sizePresets: SIZE_PRESETS,
    stylePresets: STYLE_PRESETS,
    qualities: IMAGE_QUALITIES,
    outputFormats: OUTPUT_FORMATS,
    counts: GENERATION_COUNTS
  };
}

function shouldInterceptApiRequest(request: Request): boolean {
  return new URL(request.url, "http://localhost").pathname.startsWith("/api/");
}

function shouldHandleInW3KitsRuntime(request: Request): boolean {
  const path = new URL(request.url, "http://localhost").pathname;
  return isKnownW3KitsRuntimeApiPath(path);
}

function shouldUseFallbackResponse(request: Request, response: Response): boolean {
  const path = new URL(request.url, "http://localhost").pathname;
  const contentType = response.headers.get("content-type") || "";
  const isHtmlFallback = response.ok && contentType.toLowerCase().includes("text/html");

  return isKnownW3KitsRuntimeApiPath(path) && (response.status === 404 || response.status >= 500 || isHtmlFallback);
}

function knownW3KitsRuntimeApiPaths(): Set<string> {
  return new Set([
    "/api/health",
    "/api/config",
    "/api/project",
    "/api/provider-config",
    "/api/storage/config",
    "/api/storage/config/test",
    "/api/agent-config",
    "/api/auth/status",
    "/api/auth/codex/logout",
    "/api/auth/codex/device/start",
    "/api/auth/codex/device/poll",
    "/api/gallery",
    "/api/pool",
    "/api/prompt-favorites",
    "/api/prompt-favorite-groups",
    "/api/agent-skills",
    "/api/agent-skills/import",
    "/api/agent-conversations",
    "/api/gallery/export",
    "/api/images/generate",
    "/api/images/edit"
  ]);
}

function knownW3KitsRuntimeApiPrefixes(): string[] {
  return ["/api/generations/", "/api/gallery/", "/api/assets/", "/api/prompt-favorites/", "/api/prompt-favorite-groups/", "/api/agent-skills/", "/api/agent-conversations/"];
}

function isKnownW3KitsRuntimeApiPath(path: string): boolean {
  const isKnownFallbackPrefix = (prefix: string) => path.startsWith(prefix);
  return knownW3KitsRuntimeApiPaths().has(path) || knownW3KitsRuntimeApiPrefixes().some(isKnownFallbackPrefix);
}

async function readProjectState(runtime: RuntimeLike): Promise<ProjectState> {
  return readJsonState(runtime, W3KITS_PROJECT_KEY, W3KITS_PROJECT_PATH, defaultProjectState());
}

async function readProviderConfigState(runtime: RuntimeLike): Promise<ProviderConfigResponse> {
  return normalizeRuntimeProviderConfig(
    await readJsonState(runtime, W3KITS_PROVIDER_CONFIG_KEY, W3KITS_PROVIDER_CONFIG_PATH, defaultProviderConfig(runtime)),
    runtime
  );
}

async function readStorageConfigState(runtime: RuntimeLike): Promise<StorageConfigResponse> {
  return readJsonState(runtime, W3KITS_STORAGE_CONFIG_KEY, W3KITS_STORAGE_CONFIG_PATH, defaultStorageConfig());
}

async function readAgentConfigState(runtime: RuntimeLike): Promise<AgentLlmConfigView> {
  return readJsonState(runtime, W3KITS_AGENT_CONFIG_KEY, W3KITS_AGENT_CONFIG_PATH, defaultAgentConfig());
}

async function readAuthStatusState(runtime: RuntimeLike): Promise<AuthStatusResponse> {
  const providerConfig = await readProviderConfigState(runtime);
  const agentConfig = await readAgentConfigState(runtime);
  return readJsonState(runtime, W3KITS_AUTH_STATUS_KEY, W3KITS_AUTH_STATUS_PATH, buildAuthStatus(providerConfig, agentConfig));
}

async function readState(runtime: RuntimeLike): Promise<W3KitsRuntimeState> {
  const project = await readProjectState(runtime);
  const providerConfig = await readProviderConfigState(runtime);
  const storageConfig = await readStorageConfigState(runtime);
  const agentConfig = await readAgentConfigState(runtime);
  const authStatus = await readJsonState(
    runtime,
    W3KITS_AUTH_STATUS_KEY,
    W3KITS_AUTH_STATUS_PATH,
    buildAuthStatus(providerConfig, agentConfig)
  );
  const promptFavorites = await readJsonState(runtime, W3KITS_PROMPT_FAVORITES_KEY, W3KITS_PROMPT_FAVORITES_PATH, defaultPromptFavoritesState());
  const agentSkills = await readJsonState(runtime, W3KITS_AGENT_SKILLS_KEY, W3KITS_AGENT_SKILLS_PATH, defaultAgentSkillsState());
  const agentConversations = await readJsonState(runtime, W3KITS_AGENT_CONVERSATIONS_KEY, W3KITS_AGENT_CONVERSATIONS_PATH, defaultAgentConversationsState());

  return {
    project,
    providerConfig,
    storageConfig,
    agentConfig,
    authStatus,
    promptFavorites,
    agentSkills,
    agentConversations
  };
}

function defaultProjectState(): ProjectState {
  return {
    id: "default",
    name: "Default Project",
    snapshot: null,
    history: [],
    updatedAt: new Date().toISOString()
  };
}

function saveProjectState(current: ProjectState, body: { name?: string; snapshot?: unknown }): ProjectState {
  return {
    ...current,
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : current.name,
    snapshot: Object.hasOwn(body, "snapshot") ? body.snapshot ?? null : current.snapshot,
    updatedAt: new Date().toISOString()
  };
}

function defaultProviderConfig(runtime?: RuntimeLike): ProviderConfigResponse {
  const sourceOrder: ProviderSourceId[] = [...PROVIDER_SOURCE_IDS];
  const sources = providerSourcesForConfig(undefined, isRuntimeManagedOpenAi(runtime));
  const activeSource = sources.find((source) => sourceOrder.includes(source.id) && source.available);
  return {
    sourceOrder,
    sources,
    localOpenAI: {
      apiKey: { hasSecret: false },
      baseUrl: getDefaultOpenAiBaseUrl(),
      model: IMAGE_MODEL,
      timeoutMs: 20 * 60 * 1000
    },
    activeSource: activeSource ? providerSourceSummary(activeSource) : undefined
  };
}

function saveProviderConfigState(current: ProviderConfigResponse, body: SaveProviderConfigRequest): ProviderConfigResponse {
  const sourceOrder = normalizeProviderSourceOrder(body.sourceOrder);
  const localOpenAI = resolveLocalOpenAIConfig(current.localOpenAI, body);
  const sources = providerSourcesForConfig(localOpenAI, hasRuntimeManagedOpenAiSource(current));
  const activeSource = sources.find((source) => sourceOrder.includes(source.id) && source.available);

  return {
    sourceOrder,
    sources,
    localOpenAI,
    activeSource: activeSource ? providerSourceSummary(activeSource) : undefined
  };
}

function normalizeRuntimeProviderConfig(config: ProviderConfigResponse, runtime: RuntimeLike): ProviderConfigResponse {
  if (!isRuntimeManagedOpenAi(runtime)) return config;
  const sources = providerSourcesForConfig(config.localOpenAI, true);
  const sourceOrder = normalizeProviderSourceOrder(config.sourceOrder);
  const activeSource = sources.find((source) => sourceOrder.includes(source.id) && source.available);
  return {
    ...config,
    sourceOrder,
    sources,
    activeSource: activeSource ? providerSourceSummary(activeSource) : undefined
  };
}

function isRuntimeManagedOpenAi(runtime: RuntimeLike | undefined): boolean {
  return Boolean(runtime && isW3KitsRuntime(runtime));
}

function hasRuntimeManagedOpenAiSource(config: ProviderConfigResponse): boolean {
  return Boolean(config.sources.find((source) => source.id === "env-openai" && source.available));
}

function providerSourcesForConfig(localOpenAI: ProviderConfigResponse["localOpenAI"] | undefined, runtimeManagedOpenAi = false): ProviderSourceView[] {
  const localAvailable = Boolean(localOpenAI?.apiKey.hasSecret);
  return [
    {
      id: "env-openai",
      kind: "environment",
      label: runtimeManagedOpenAi ? "OpenAI-compatible API" : "Environment OpenAI API",
      available: runtimeManagedOpenAi,
      status: runtimeManagedOpenAi ? "available" : "missing_api_key",
      details: {
        baseUrl: getDefaultOpenAiBaseUrl(),
        model: IMAGE_MODEL,
        timeoutMs: 20 * 60 * 1000
      },
      secret: { hasSecret: runtimeManagedOpenAi }
    },
    {
      id: "local-openai",
      kind: "local",
      label: "Custom OpenAI-compatible API",
      available: localAvailable,
      status: localAvailable ? "available" : "missing_api_key",
      details: {
        baseUrl: localOpenAI?.baseUrl ?? "",
        model: localOpenAI?.model ?? IMAGE_MODEL,
        timeoutMs: localOpenAI?.timeoutMs ?? 20 * 60 * 1000
      },
      secret: localOpenAI?.apiKey ?? { hasSecret: false }
    },
    {
      id: "codex",
      kind: "codex",
      label: "Codex",
      available: false,
      status: "missing_codex_session",
      details: {
        codex: {
          available: false,
          unavailableReason: "Codex session is not connected in cache fallback mode."
        }
      },
      secret: { hasSecret: false }
    }
  ];
}

function providerSourceSummary(source: ProviderSourceView): ProviderSourceSummary {
  return {
    id: source.id,
    kind: source.kind,
    label: source.label,
    provider: source.id === "codex" ? "codex" : "openai",
    available: source.available,
    status: source.status
  };
}

function resolveLocalOpenAIConfig(
  current: ProviderConfigResponse["localOpenAI"],
  body: SaveProviderConfigRequest
): ProviderConfigResponse["localOpenAI"] {
  const local = body.localOpenAI;
  if (!local) {
    return current;
  }

  const apiKey = resolveSecret(local.apiKey, local.preserveApiKey, current.apiKey.value);
  return {
    apiKey: maskedSecret(apiKey),
    baseUrl: typeof local.baseUrl === "string" ? local.baseUrl.trim() : current.baseUrl,
    model: typeof local.model === "string" && local.model.trim() ? local.model.trim() : current.model,
    timeoutMs: typeof local.timeoutMs === "number" && Number.isInteger(local.timeoutMs) && local.timeoutMs > 0
      ? local.timeoutMs
      : current.timeoutMs
  };
}

function defaultStorageConfig(): StorageConfigResponse {
  return {
    enabled: false,
    provider: "cos",
    cos: {
      secretId: "",
      secretKey: { hasSecret: false },
      bucket: "",
      region: "",
      keyPrefix: ""
    },
    s3: {
      accessKeyId: "",
      secretAccessKey: { hasSecret: false },
      bucket: "",
      region: "",
      keyPrefix: "",
      endpointMode: "r2-account",
      accountId: "",
      endpoint: "",
      forcePathStyle: false
    }
  };
}

function saveStorageConfigState(current: StorageConfigResponse, body: SaveStorageConfigRequest): StorageConfigResponse {
  return {
    enabled: Boolean(body.enabled),
    provider: body.provider,
    cos: current.cos,
    s3: current.s3
  };
}

function defaultAgentConfig(): AgentLlmConfigView {
  return {
    configured: false,
    apiKey: { hasSecret: false },
    baseUrl: getDefaultOpenAiBaseUrl(),
    model: "gpt-5.4-mini",
    timeoutMs: 60_000,
    supportsVision: true,
    createdAt: "",
    updatedAt: ""
  };
}

function unavailablePromptPoolResponse() {
  return {
    available: false,
    errorCode: "prompt_pool_missing" as const,
    items: [],
    summary: {
      promptCount: 0,
      imagePromptCount: 0,
      videoPromptCount: 0,
      assetCount: 0
    }
  };
}

async function loadPromptPoolResponse(runtime: RuntimeLike): Promise<PromptPoolResponse> {
  if (cachedPromptPoolResponse) {
    return cachedPromptPoolResponse;
  }

  try {
    const [itemsResponse, summaryResponse] = await Promise.all([
      runtime.fetch(W3KITS_PROMPT_POOL_BUNDLE_PATH),
      runtime.fetch(W3KITS_PROMPT_POOL_SUMMARY_PATH).catch(() => null)
    ]);

    if (!itemsResponse.ok) {
      return unavailablePromptPoolResponse();
    }

    const itemsPayload = await itemsResponse.json().catch(() => []);
    const summaryPayload = summaryResponse && summaryResponse.ok ? await summaryResponse.json().catch(() => undefined) : undefined;
    const items = Array.isArray(itemsPayload) ? itemsPayload.flatMap((item) => {
      const normalized = normalizePromptPoolBundleItem(item);
      return normalized ? [normalized] : [];
    }) : [];

    cachedPromptPoolResponse = {
      available: items.length > 0,
      items,
      summary: normalizePromptPoolBundleSummary(summaryPayload, items)
    };
    return cachedPromptPoolResponse;
  } catch {
    return unavailablePromptPoolResponse();
  }
}

function normalizePromptPoolBundleItem(value: unknown): PromptPoolItem | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = readStringValue(value.id);
  const prompt = readStringValue(value.prompt);
  const assetUrl = readPromptPoolAssetUrl(value);
  if (!id || !prompt || !assetUrl) {
    return undefined;
  }

  const mediaType = normalizePromptPoolMediaType(value.mediaType);
  const imageWidth = readPositiveNumberValue(value.imageWidth);
  const imageHeight = readPositiveNumberValue(value.imageHeight);
  return {
    id,
    title: readStringValue(value.title) || promptExcerpt(prompt, 84),
    prompt,
    mediaType,
    model: readStringValue(value.model) || (mediaType === "video" ? "Video" : "Image"),
    postedAt: readStringValue(value.postedAt),
    promptReady: value.promptReady === true,
    assetUrl,
    imageCount: readImageCountValue(value.images),
    imageWidth,
    imageHeight,
    aspectRatio: readStringValue(value.aspectRatio) || (imageWidth && imageHeight ? `${imageWidth}:${imageHeight}` : undefined),
    author: normalizePromptPoolAuthor(value.author),
    stats: normalizePromptPoolStats(value.stats),
    sourceUrl: normalizePromptPoolSourceUrl(value.author)
  };
}

function readPromptPoolAssetUrl(value: Record<string, unknown>): string | undefined {
  const image = readHttpsUrlValue(value.image);
  if (image) {
    return image;
  }

  const images = Array.isArray(value.images) ? value.images : [];
  for (const entry of images) {
    const url = readHttpsUrlValue(entry);
    if (url) {
      return url;
    }
  }

  return undefined;
}

function normalizePromptPoolBundleSummary(value: unknown, items: PromptPoolItem[]): PromptPoolSummary {
  const sourceSummary = isRecord(value) && isRecord(value.sourceSummary) ? value.sourceSummary : undefined;
  return {
    builtAt: isRecord(value) ? readStringValue(value.builtAt) : undefined,
    scrapedAt: sourceSummary ? readStringValue(sourceSummary.scrapedAt) : undefined,
    siteUrl: sourceSummary ? readHttpsUrlValue(sourceSummary.siteUrl) : undefined,
    promptCount: readNonNegativeIntegerValue(isRecord(value) ? value.promptCount : undefined) ?? items.length,
    imagePromptCount:
      readNonNegativeIntegerValue(isRecord(value) ? value.imagePromptCount : undefined) ??
      items.filter((item) => item.mediaType === "image").length,
    videoPromptCount:
      readNonNegativeIntegerValue(isRecord(value) ? value.videoPromptCount : undefined) ??
      items.filter((item) => item.mediaType === "video").length,
    assetCount:
      readNonNegativeIntegerValue(isRecord(value) ? value.assetCount : undefined) ??
      items.reduce((count, item) => count + Math.max(item.imageCount, 1), 0)
  };
}

function normalizePromptPoolAuthor(value: unknown): PromptPoolAuthor | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const name = readStringValue(value.name);
  if (!name) {
    return undefined;
  }

  return {
    name,
    username: readStringValue(value.username),
    verified: value.verified === true,
    profileUrl: readHttpsUrlValue(value.profileUrl)
  };
}

function normalizePromptPoolStats(value: unknown): PromptPoolStats {
  if (!isRecord(value)) {
    return { likes: 0, views: 0, retweets: 0 };
  }

  return {
    likes: readNonNegativeIntegerValue(value.likes) ?? 0,
    views: readNonNegativeIntegerValue(value.views) ?? 0,
    retweets: readNonNegativeIntegerValue(value.retweets) ?? 0
  };
}

function normalizePromptPoolSourceUrl(author: unknown): string | undefined {
  if (!isRecord(author)) {
    return undefined;
  }
  return readHttpsUrlValue(author.profileUrl);
}

function normalizePromptPoolMediaType(value: unknown): PromptPoolMediaType {
  return value === "video" ? "video" : "image";
}

function readStringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readHttpsUrlValue(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function readPositiveNumberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function readNonNegativeIntegerValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function readImageCountValue(value: unknown): number {
  return Array.isArray(value) ? Math.max(value.filter((item) => typeof item === "string" && item.trim()).length, 1) : 1;
}

function promptExcerpt(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/gu, " ").trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 3)}...` : compact;
}

function defaultPromptFavoritesState(): PromptFavoriteStateEnvelope {
  const group = defaultPromptFavoriteGroup();
  return {
    groups: [group],
    favorites: []
  };
}

function defaultPromptFavoriteGroup(): PromptFavoriteGroup {
  const now = new Date().toISOString();
  return {
    id: "favorites-default",
    name: "Favorites",
    sortOrder: 0,
    isDefault: true,
    createdAt: now,
    updatedAt: now
  };
}

function defaultAgentSkillsState(): AgentSkillDetail[] {
  return builtInAgentSkillDefinitions().map((definition, index) => agentSkillFromDefinition(definition, index));
}

function defaultAgentConversationsState(): AgentConversation[] {
  return [];
}

function saveAgentConfigState(current: AgentLlmConfigView, body: SaveAgentLlmConfigRequest): AgentLlmConfigView {
  const apiKey = resolveSecret(body.apiKey, body.preserveApiKey, current.apiKey.value);
  return {
    configured: Boolean(apiKey && body.model.trim()),
    apiKey: maskedSecret(apiKey),
    baseUrl: body.baseUrl.trim(),
    model: body.model.trim(),
    timeoutMs: body.timeoutMs,
    supportsVision: Boolean(body.supportsVision),
    createdAt: current.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function buildAuthStatus(providerConfig: ProviderConfigResponse, _agentConfig: AgentLlmConfigView): AuthStatusResponse {
  const openaiConfigured = Boolean(
    providerConfig.sources.some((source) => (source.id === "env-openai" || source.id === "local-openai") && source.available)
  );
  return {
    provider: providerConfig.activeSource?.provider ?? "none",
    openaiConfigured,
    codex: {
      available: false,
      unavailableReason: "Codex session is not connected in cache fallback mode."
    },
    activeSource: providerConfig.activeSource
  };
}

function buildGalleryResponse(project: ProjectState): GalleryResponse {
  const items: GalleryResponse["items"] = [];
  for (const record of project.history) {
    for (const output of record.outputs) {
      if (output.status !== "succeeded" || !output.asset) {
        continue;
      }

      items.push(generationRecordToGalleryItem(record, output.asset, output.id));
    }
  }

  return { items };
}

async function buildGalleryArchiveResponse(
  runtime: RuntimeLike,
  project: ProjectState,
  outputIds: string[]
): Promise<Response> {
  const uniqueOutputIds = Array.from(new Set(outputIds.map((value) => value.trim()).filter(Boolean)));
  if (uniqueOutputIds.length === 0) {
    return jsonError(400, "invalid_gallery_export_request", "Select at least one Gallery image to export.");
  }

  const files: Array<{ name: string; bytes: Uint8Array }> = [];
  for (const outputId of uniqueOutputIds) {
    const match = findGalleryOutput(project, outputId);
    if (!match?.asset) {
      return jsonError(404, "gallery_export_not_found", "One or more Gallery images were not found.");
    }

    const assetRecord = await readStoredAssetRecord(runtime, match.asset.id);
    if (!assetRecord) {
      return jsonError(404, "gallery_export_asset_unavailable", "One or more Gallery original assets are unavailable.");
    }

    files.push({
      name: assetRecord.fileName,
      bytes: await readStoredAssetBody(runtime, assetRecord)
    });
  }

  const archive = buildStoredZipArchive(files);
  return new Response(bytesToArrayBuffer(archive), {
    status: 200,
    headers: {
      "Content-Disposition": 'attachment; filename="gpt-image-canvas-gallery.zip"',
      "Content-Type": "application/zip"
    }
  });
}

async function handleGenerateImageRequest(
  runtime: RuntimeLike,
  state: W3KitsRuntimeState,
  request: Request,
  mode: "generate" | "edit"
): Promise<Response> {
  const requestBody =
    mode === "edit"
      ? await readJsonBody<EditImageRequest>(request)
      : await readJsonBody<GenerateImageRequest>(request);
  if (!requestBody) {
    return jsonError(400, "invalid_json", "The request body must be valid JSON.");
  }

  try {
    const record = await generateRecordViaW3Kits(runtime, requestBody, mode);
    const nextProject = upsertProjectHistory(state.project, record);
    await writeJsonState(runtime, W3KITS_PROJECT_KEY, W3KITS_PROJECT_PATH, nextProject);
    return jsonResponse({ record } satisfies GenerationResponse);
  } catch (error) {
    if (isLoginRequiredError(error)) {
      requestW3KitsLogin(runtime, "ai_request");
      return jsonError(401, "login_required", error instanceof Error ? error.message : "Sign in required before using the OpenAI-compatible provider.");
    }

    return jsonError(502, "upstream_failure", error instanceof Error ? error.message : "Image generation failed.");
  }
}

function generationRecordToGalleryItem(record: GenerationRecord, asset: GeneratedAsset, outputId: string): GalleryResponse["items"][number] {
  return {
    outputId,
    generationId: record.id,
    mode: record.mode,
    prompt: record.prompt,
    effectivePrompt: record.effectivePrompt,
    presetId: record.presetId,
    size: record.size,
    quality: record.quality,
    outputFormat: record.outputFormat,
    createdAt: record.createdAt,
    asset
  };
}

function normalizeProviderSourceOrder(value: ProviderSourceId[]): ProviderSourceId[] {
  const seen = new Set<ProviderSourceId>();
  const order: ProviderSourceId[] = [];
  for (const sourceId of value) {
    if (!PROVIDER_SOURCE_IDS.includes(sourceId) || seen.has(sourceId)) {
      continue;
    }

    seen.add(sourceId);
    order.push(sourceId);
  }

  return order.length > 0 ? order : [...PROVIDER_SOURCE_IDS];
}

function upsertProjectHistory(project: ProjectState, record: GenerationRecord): ProjectState {
  return {
    ...project,
    history: [record, ...project.history.filter((item) => item.id !== record.id)].slice(0, 20),
    updatedAt: new Date().toISOString()
  };
}

function cancelGenerationRecord(project: ProjectState, generationId: string): ProjectState {
  let changed = false;
  const history = project.history.map((record) => {
    if (record.id !== generationId) {
      return record;
    }

    changed = true;
    return {
      ...record,
      status: "cancelled" as const,
      error: record.error ?? "Cancelled.",
      outputs: record.outputs.map((output) =>
        output.status === "failed" || output.status === "succeeded"
          ? output
          : { ...output, status: "failed" as const, error: output.error ?? "Cancelled." }
      )
    };
  });

  return changed ? { ...project, history, updatedAt: new Date().toISOString() } : project;
}

function deleteGalleryOutput(project: ProjectState, outputId: string): ProjectState {
  let changed = false;
  const history = project.history.map((record) => {
    const nextOutputs = record.outputs.filter((output) => output.id !== outputId);
    if (nextOutputs.length === record.outputs.length) {
      return record;
    }

    changed = true;
    return {
      ...record,
      outputs: nextOutputs
    };
  });

  return changed ? { ...project, history, updatedAt: new Date().toISOString() } : project;
}

function assetIdsForGalleryOutput(project: ProjectState, outputId: string): string[] {
  const ids: string[] = [];
  for (const record of project.history) {
    for (const output of record.outputs) {
      if (output.id === outputId && output.asset?.id) {
        ids.push(output.asset.id);
      }
    }
  }
  return ids;
}

function findGalleryOutput(project: ProjectState, outputId: string): GenerationOutput | undefined {
  for (const record of project.history) {
    for (const output of record.outputs) {
      if (output.id === outputId) {
        return output;
      }
    }
  }
  return undefined;
}

function createPromptFavoriteGroupState(
  state: PromptFavoriteStateEnvelope,
  name: string
): { state: PromptFavoriteStateEnvelope; group: PromptFavoriteGroup } {
  const now = new Date().toISOString();
  const group: PromptFavoriteGroup = {
    id: `favorite-group-${crypto.randomUUID()}`,
    name,
    sortOrder: state.groups.length,
    isDefault: false,
    createdAt: now,
    updatedAt: now
  };
  return {
    state: {
      ...state,
      groups: [...state.groups, group]
    },
    group
  };
}

function createPromptFavoriteState(
  state: PromptFavoriteStateEnvelope,
  item: PromptPoolItem,
  groupId?: string
): { state: PromptFavoriteStateEnvelope; favorite: PromptFavoriteItem } {
  const now = new Date().toISOString();
  const group = groupId ? state.groups.find((candidate) => candidate.id === groupId) : undefined;
  const targetGroup = group ?? state.groups.find((candidate) => candidate.isDefault) ?? defaultPromptFavoriteGroup();
  const favorite: PromptFavoriteItem = {
    id: `favorite-${crypto.randomUUID()}`,
    sourceType: "pool",
    sourceId: item.id,
    groupId: targetGroup.id,
    title: item.title,
    prompt: item.prompt,
    model: item.model,
    mediaType: item.mediaType,
    assetUrl: item.assetUrl,
    imageWidth: item.imageWidth,
    imageHeight: item.imageHeight,
    sourceUrl: item.sourceUrl,
    useCount: 0,
    createdAt: now,
    updatedAt: now
  };

  return {
    state: {
      ...state,
      groups: group ? state.groups : [...state.groups, targetGroup],
      favorites: [favorite, ...state.favorites.filter((candidate) => candidate.sourceId !== item.id)]
    },
    favorite
  };
}

function updatePromptFavoriteGroupState(
  state: PromptFavoriteStateEnvelope,
  groupId: string,
  name: string
): { state: PromptFavoriteStateEnvelope; group: PromptFavoriteGroup } | null {
  let updatedGroup: PromptFavoriteGroup | null = null;
  const groups = state.groups.map((group) => {
    if (group.id !== groupId) {
      return group;
    }

    updatedGroup = {
      ...group,
      name,
      updatedAt: new Date().toISOString()
    };
    return updatedGroup;
  });

  return updatedGroup ? { state: { ...state, groups }, group: updatedGroup } : null;
}

function deletePromptFavoriteGroupState(
  state: PromptFavoriteStateEnvelope,
  groupId: string
): { state: PromptFavoriteStateEnvelope } | null {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) {
    return null;
  }

  const defaultGroup = state.groups.find((item) => item.isDefault) ?? defaultPromptFavoriteGroup();
  if (group.isDefault) {
    return { state };
  }

  return {
    state: {
      groups: state.groups.filter((item) => item.id !== groupId),
      favorites: state.favorites.map((favorite) => favorite.groupId === groupId ? { ...favorite, groupId: defaultGroup.id, updatedAt: new Date().toISOString() } : favorite)
    }
  };
}

function updatePromptFavoriteState(
  state: PromptFavoriteStateEnvelope,
  favoriteId: string,
  groupId: string
): { state: PromptFavoriteStateEnvelope; favorite: PromptFavoriteItem } | null {
  if (!state.groups.some((group) => group.id === groupId)) {
    throw new Error("Favorite group was not found.");
  }

  let updatedFavorite: PromptFavoriteItem | null = null;
  const favorites = state.favorites.map((favorite) => {
    if (favorite.id !== favoriteId) {
      return favorite;
    }

    updatedFavorite = {
      ...favorite,
      groupId,
      updatedAt: new Date().toISOString()
    };
    return updatedFavorite;
  });

  return updatedFavorite ? { state: { ...state, favorites }, favorite: updatedFavorite } : null;
}

function deletePromptFavoriteState(
  state: PromptFavoriteStateEnvelope,
  favoriteId: string
): { state: PromptFavoriteStateEnvelope } | null {
  if (!state.favorites.some((favorite) => favorite.id === favoriteId)) {
    return null;
  }

  return {
    state: {
      ...state,
      favorites: state.favorites.filter((favorite) => favorite.id !== favoriteId)
    }
  };
}

function markPromptFavoriteUsedState(
  state: PromptFavoriteStateEnvelope,
  favoriteId: string
): { state: PromptFavoriteStateEnvelope; favorite: PromptFavoriteItem } | null {
  let updatedFavorite: PromptFavoriteItem | null = null;
  const now = new Date().toISOString();
  const favorites = state.favorites.map((favorite) => {
    if (favorite.id !== favoriteId) {
      return favorite;
    }

    updatedFavorite = {
      ...favorite,
      useCount: favorite.useCount + 1,
      lastUsedAt: now,
      updatedAt: now
    };
    return updatedFavorite;
  });

  return updatedFavorite ? { state: { ...state, favorites }, favorite: updatedFavorite } : null;
}

function summarizeAgentSkills(skills: AgentSkillDetail[]): AgentSkillListResponse["skills"] {
  return skills.map((skill) => ({
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    version: skill.version,
    source: skill.source,
    enabled: skill.enabled,
    builtIn: skill.builtIn,
    required: skill.required,
    triggerMode: skill.triggerMode,
    triggerKeywords: skill.triggerKeywords,
    fileCount: skill.files.length,
    hasLocalChanges: skill.hasLocalChanges,
    createdAt: skill.createdAt,
    updatedAt: skill.updatedAt
  }));
}

function builtInAgentSkillDefinitions(): BuiltInAgentSkillDefinition[] {
  return [
    {
      slug: "canvas-image-planning",
      name: "canvas-image-planning",
      description: "Turn a creator image request into structured planning guidance for the canvas.",
      version: "w3kits-v1",
      enabled: true,
      required: true,
      triggerMode: "always",
      triggerKeywords: [],
      files: [
        {
          path: "SKILL.md",
          content: "# canvas-image-planning\n\nTurn an image request into a concrete generation plan for this image canvas runtime.\n"
        }
      ]
    },
    {
      slug: "ecommerce-visual-copywriting",
      name: "ecommerce-visual-copywriting",
      description: "Improve ecommerce image prompts with clearer merchandising and compliance guidance.",
      version: "w3kits-v1",
      source: "https://github.com/feichanggege/ecommerce-visual-copywriting-skill",
      enabled: true,
      required: false,
      triggerMode: "auto",
      triggerKeywords: ["ecommerce", "listing", "product detail", "电商", "主图", "详情页"],
      files: [
        {
          path: "SKILL.md",
          content: "# ecommerce-visual-copywriting\n\nAdd concise ecommerce-focused direction for hero images, detail shots, and platform-safe wording.\n"
        }
      ]
    }
  ];
}

function agentSkillFromDefinition(definition: BuiltInAgentSkillDefinition, index: number): AgentSkillDetail {
  const now = new Date().toISOString();
  return {
    id: `agent-skill-built-in-${index + 1}`,
    slug: definition.slug,
    name: definition.name,
    description: definition.description,
    version: definition.version,
    source: definition.source,
    enabled: definition.enabled,
    builtIn: true,
    required: definition.required,
    triggerMode: definition.triggerMode,
    triggerKeywords: [...definition.triggerKeywords],
    fileCount: definition.files.length,
    hasLocalChanges: false,
    createdAt: now,
    updatedAt: now,
    files: definition.files.map((file) => ({ ...file }))
  };
}

function findAgentSkill(skills: AgentSkillDetail[], idOrSlug: string): AgentSkillDetail | undefined {
  return skills.find((skill) => skill.id === idOrSlug || skill.slug === idOrSlug);
}

function upsertAgentSkill(skills: AgentSkillDetail[], skill: AgentSkillDetail): AgentSkillDetail[] {
  return [skill, ...skills.filter((item) => item.id !== skill.id)];
}

function createAgentSkillState(skills: AgentSkillDetail[], input: SaveAgentSkillRequest): { skills: AgentSkillDetail[]; skill: AgentSkillDetail } {
  const name = normalizeRequiredText(input.name, "Agent skill name is required.");
  const slug = uniqueAgentSkillSlug(skills, normalizeAgentSkillSlug(input.slug || name), undefined);
  const now = new Date().toISOString();
  const skill: AgentSkillDetail = {
    id: `agent-skill-${crypto.randomUUID()}`,
    slug,
    name,
    description: normalizeOptionalText(input.description) ?? "",
    version: normalizeOptionalText(input.version),
    source: normalizeOptionalText(input.source),
    enabled: input.enabled ?? true,
    builtIn: false,
    required: false,
    triggerMode: input.triggerMode === "always" ? "always" : "auto",
    triggerKeywords: normalizeTriggerKeywords(input.triggerKeywords),
    fileCount: normalizeAgentSkillFiles(input.files).length,
    hasLocalChanges: false,
    createdAt: now,
    updatedAt: now,
    files: normalizeAgentSkillFiles(input.files)
  };
  return { skills: upsertAgentSkill(skills, skill), skill };
}

function saveAgentSkillState(skills: AgentSkillDetail[], idOrSlug: string, input: SaveAgentSkillRequest): { skills: AgentSkillDetail[]; skill: AgentSkillDetail } {
  const existing = findAgentSkill(skills, idOrSlug);
  if (!existing) {
    throw new Error("Agent skill was not found.");
  }

  const builtInDefinition = existing.builtIn ? builtInAgentSkillDefinitions().find((definition) => definition.slug === existing.slug) : undefined;
  let nextSkill: AgentSkillDetail;
  if (input.resetToFactory === true && builtInDefinition) {
    nextSkill = {
      ...agentSkillFromDefinition(builtInDefinition, skills.findIndex((skill) => skill.id === existing.id)),
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    };
  } else {
    const name = normalizeRequiredText(input.name || existing.name, "Agent skill name is required.");
    const slug = existing.builtIn ? existing.slug : uniqueAgentSkillSlug(skills, normalizeAgentSkillSlug(input.slug || existing.slug || name), existing.id);
    const enabled = existing.required ? true : (input.enabled ?? existing.enabled);
    const files = input.files ? normalizeAgentSkillFiles(input.files) : existing.files;
    nextSkill = {
      ...existing,
      slug,
      name,
      description: input.description === undefined ? existing.description : normalizeOptionalText(input.description) ?? "",
      version: input.version === undefined ? existing.version : normalizeOptionalText(input.version),
      source: input.source === undefined ? existing.source : normalizeOptionalText(input.source),
      enabled,
      triggerMode: existing.required ? "always" : (input.triggerMode === "always" ? "always" : input.triggerMode === "auto" ? "auto" : existing.triggerMode),
      triggerKeywords: input.triggerKeywords === undefined ? existing.triggerKeywords : normalizeTriggerKeywords(input.triggerKeywords),
      files,
      fileCount: files.length,
      hasLocalChanges: existing.builtIn ? true : existing.hasLocalChanges,
      updatedAt: new Date().toISOString()
    };
  }

  return {
    skills: upsertAgentSkill(skills.filter((skill) => skill.id !== existing.id), nextSkill),
    skill: nextSkill
  };
}

async function importAgentSkillState(request: Request, skills: AgentSkillDetail[]): Promise<AgentSkillDetail> {
  const formData = await request.formData();
  const file = formData.get("file") ?? formData.get("skill") ?? formData.get("bundle");
  if (!(file instanceof File)) {
    throw new Error("Upload a SKILL.md file.");
  }

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".zip")) {
    throw new Error("Zip skill bundles are not supported in the browser fallback yet.");
  }

  const content = await file.text();
  const name = readImportedSkillName(content) || file.name.replace(/\.[^.]+$/u, "") || "Imported Agent skill";
  const created = createAgentSkillState(skills, {
    name,
    slug: normalizeAgentSkillSlug(name),
    description: "",
    enabled: true,
    triggerMode: "auto",
    triggerKeywords: [],
    files: [{ path: "SKILL.md", content }]
  });
  return created.skill;
}

function readImportedSkillName(content: string): string | undefined {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading || undefined;
}

function normalizeAgentSkillFiles(files: AgentSkillFile[] | undefined): AgentSkillFile[] {
  const nextFiles = Array.isArray(files) ? files : [];
  const normalized = nextFiles
    .map((file) => ({
      path: normalizeRequiredText(file.path, "Agent skill file path is required."),
      content: typeof file.content === "string" ? file.content : ""
    }))
    .filter((file, index, array) => array.findIndex((item) => item.path === file.path) === index);

  return normalized.length > 0 ? normalized : [{ path: "SKILL.md", content: "# skill\n" }];
}

function normalizeAgentSkillSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63) || `skill-${crypto.randomUUID().slice(0, 8)}`;
}

function uniqueAgentSkillSlug(skills: AgentSkillDetail[], slug: string, currentId: string | undefined): string {
  const existing = skills.find((skill) => skill.slug === slug && skill.id !== currentId);
  if (existing) {
    throw new Error("Agent skill slug already exists.");
  }
  return slug;
}

function normalizeTriggerKeywords(value: string[] | undefined): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map((item) => item.trim()).filter(Boolean))).slice(0, 32);
}

function normalizeRequiredText(value: string | undefined, message: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(message);
  }
  return normalized;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function summarizeAgentConversations(conversations: AgentConversation[]): AgentConversationSummary[] {
  return [...conversations]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      messageCount: conversation.messages.length,
      lastMessagePreview: conversation.messages[conversation.messages.length - 1]?.content?.slice(0, 160),
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    }))
    .filter((conversation) => conversation.messageCount > 0)
    .slice(0, 20);
}

function saveAgentConversationState(
  conversations: AgentConversation[],
  conversationId: string,
  input: SaveAgentConversationRequest
): AgentConversation {
  const existing = conversations.find((item) => item.id === conversationId);
  const createdAt = existing?.createdAt ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const messages = sanitizeConversationMessages(input.messages);
  const title = normalizeOptionalText(input.title) ?? inferConversationTitle(messages) ?? existing?.title ?? "Agent conversation";
  return {
    id: conversationId,
    title,
    messages,
    createdAt,
    updatedAt
  };
}

function upsertAgentConversation(conversations: AgentConversation[], conversation: AgentConversation): AgentConversation[] {
  return [conversation, ...conversations.filter((item) => item.id !== conversation.id)];
}

function sanitizeConversationMessages(messages: AgentConversationMessage[]): AgentConversationMessage[] {
  return messages
    .filter((message) => typeof message.id === "string" && typeof message.role === "string" && typeof message.content === "string" && typeof message.timestamp === "string")
    .slice(0, 200);
}

function inferConversationTitle(messages: AgentConversationMessage[]): string | undefined {
  const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim());
  return firstUserMessage?.content.trim().slice(0, 120) || undefined;
}

function resolveSecret(value: string | undefined, preserveSecret: boolean | undefined, fallback: string | undefined): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }

    return preserveSecret ? (fallback ?? null) : null;
  }

  return preserveSecret ? (fallback ?? null) : fallback ?? null;
}

function maskedSecret(value: string | null): { hasSecret: boolean; value?: string } {
  if (!value) {
    return { hasSecret: false };
  }

  if (value.length <= 8) {
    return { hasSecret: true, value: "*".repeat(value.length) };
  }

  const hidden = "*".repeat(Math.min(8, Math.max(4, value.length - 8)));
  return { hasSecret: true, value: `${value.slice(0, 4)}${hidden}${value.slice(-4)}` };
}

function inferLocale(navigatorLike: Pick<Navigator, "language" | "languages"> | undefined): Locale | undefined {
  const languages = navigatorLike?.languages ?? (navigatorLike?.language ? [navigatorLike.language] : []);
  for (const language of languages) {
    const normalized = normalizeLocale(language);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

function normalizeLocale(value: string | null | undefined): Locale | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "zh" || normalized === "zh-cn" || normalized === "zh_hans_cn") {
    return "zh-CN";
  }

  if (normalized === "en" || normalized === "en-us" || normalized === "en_gb") {
    return "en";
  }

  return undefined;
}

function readPathParam(pathname: string, prefix: string): string | undefined {
  if (!pathname.startsWith(prefix)) {
    return undefined;
  }

  const value = pathname.slice(prefix.length).split("/")[0]?.trim();
  return value ? decodeURIComponent(value) : undefined;
}

async function readJsonState<T>(runtime: RuntimeLike, key: string, path: string, fallback: T): Promise<T> {
  const cached = readStateCache<T>(key, path);
  if (cached !== undefined) return cached;

  const cacheKey = stateCacheKey(key, path);
  const existing = stateInflight.get(cacheKey);
  if (existing) return existing as Promise<T>;

  const load = (async () => {
    if (isW3KitsRuntime(runtime)) {
      const entry = await readW3KitsStorage(runtime, path);
      if (entry?.body) {
        try {
          const parsed = JSON.parse(entry.body) as T;
          runtime.localStorage.setItem(key, JSON.stringify(parsed));
          writeStateCache(key, path, parsed);
          return parsed;
        } catch {
          writeStateCache(key, path, fallback);
          return fallback;
        }
      }
    }

    const raw = runtime.localStorage.getItem(key);
    if (!raw) {
      writeStateCache(key, path, fallback);
      return fallback;
    }
    try {
      const parsed = JSON.parse(raw) as T;
      writeStateCache(key, path, parsed);
      return parsed;
    } catch {
      writeStateCache(key, path, fallback);
      return fallback;
    }
  })();

  stateInflight.set(cacheKey, load);
  try {
    return await load;
  } finally {
    stateInflight.delete(cacheKey);
  }
}

async function writeJsonState(
  runtime: RuntimeLike,
  key: string,
  path: string,
  value: unknown,
  options: { sync?: boolean } = {},
): Promise<void> {
  const text = JSON.stringify(value);
  writeStateCache(key, path, value);
  stateInflight.delete(stateCacheKey(key, path));

  if (isW3KitsRuntime(runtime)) {
    await writeW3KitsStorage(runtime, path, text, "application/json;charset=UTF-8");
    if (options.sync !== false) {
      await syncW3KitsStorage(runtime).catch(() => undefined);
    }
    return;
  }

  runtime.localStorage.setItem(key, text);
}

async function readJsonBody<T>(request: Request): Promise<T | undefined> {
  try {
    const text = await request.text();
    if (!text.trim()) {
      return undefined;
    }

    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return jsonResponse(
    {
      error: {
        code,
        message
      }
    },
    { status }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function queryParam(runtime: Pick<RuntimeLike, "location">, name: string): string | null {
  return new URL(runtime.location.href).searchParams.get(name);
}

function isW3KitsRuntime(runtime: RuntimeLike): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (window.parent !== window) {
    return true;
  }

  return Boolean(queryParam(runtime, "w3kitsParentOrigin") || queryParam(runtime, "w3kitsOpenAiBaseUrl") || queryParam(runtime, "openaiBaseUrl"));
}

function getDefaultOpenAiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "https://w3kits.com/api/ai/openai/v1";
  }

  return (
    new URL(window.location.href).searchParams.get("openaiBaseUrl") ||
    new URL(window.location.href).searchParams.get("w3kitsOpenAiBaseUrl") ||
    "https://w3kits.com/api/ai/openai/v1"
  ).replace(/\/+$/, "");
}

function getW3KitsParentOrigin(runtime: RuntimeLike): string {
  const parentOrigin = queryParam(runtime, "w3kitsParentOrigin");
  if (parentOrigin) {
    return parentOrigin;
  }

  try {
    return new URL(getDefaultOpenAiBaseUrl()).origin;
  } catch {
    return "https://w3kits.com";
  }
}

function getBridgeErrorMessage(error: BridgeErrorShape | undefined): string {
  if (typeof error?.message === "string" && error.message) {
    return error.message;
  }

  if (typeof error?.code === "string" && error.code) {
    return error.code;
  }

  return "W3Kits runtime bridge failed.";
}

function isNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("not_found") || message.includes("not found");
}

function requestW3KitsLogin(runtime: RuntimeLike, reason: string): void {
  if (typeof window === "undefined" || window.parent === window) {
    return;
  }

  window.parent.postMessage(
    {
      type: W3KITS_AUTH_REQUIRED,
      version: W3KITS_BRIDGE_VERSION,
      pluginId: W3KITS_PLUGIN_ID,
      reason
    },
    getW3KitsParentOrigin(runtime)
  );
}

function bridgeRequest<T>(runtime: RuntimeLike, message: Record<string, unknown>, timeoutMs = 10_000): Promise<T> {
  if (typeof window === "undefined" || window.parent === window) {
    return Promise.reject(new Error("W3Kits runtime bridge is unavailable."));
  }

  const requestId = `${W3KITS_PLUGIN_ID}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const parentOrigin = getW3KitsParentOrigin(runtime);

  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      reject(new Error("W3Kits runtime bridge timed out."));
    }, timeoutMs);

    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== parentOrigin) {
        return;
      }

      const data = event.data as BridgeResponse<T>;
      if (data?.type !== W3KITS_RESPONSE || data.requestId !== requestId) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);

      if (data.ok) {
        resolve(data.data as T);
      } else {
        reject(new Error(getBridgeErrorMessage(data.error)));
      }
    };

    window.addEventListener("message", onMessage);
    window.parent.postMessage({ ...message, version: W3KITS_BRIDGE_VERSION, requestId }, parentOrigin);
  });
}

function w3kitsObjectStorage(session: W3KitsRuntimeSession): W3KitsObjectFacadeStorage {
  const storage = session.storage;
  if (!storage || storage.type !== "w3kits-vfs-object-facade" || !storage.endpoint || !storage.bucket) {
    throw new Error("w3kits_object_facade_unavailable");
  }
  return storage;
}

function w3kitsObjectUrl(runtime: RuntimeLike, storage: W3KitsObjectFacadeStorage, path: string, options: { formatJson?: boolean; sync?: boolean } = {}): string {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const key = normalizedPath.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const endpoint = storage.endpoint.replace(/\/+$/, "");
  const base = new URL(endpoint + "/" + encodeURIComponent(storage.bucket) + (key ? "/" + key : ""), getW3KitsParentOrigin(runtime));
  if (options.formatJson) base.searchParams.set("format", "json");
  if (options.sync) {
    base.searchParams.set("sync", "1");
    base.searchParams.set("format", "json");
  }
  return base.toString();
}

function w3kitsObjectHeaders(session: W3KitsRuntimeSession, contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    [session.runtimeSessionHeader || "x-w3kits-runtime-session"]: session.token,
    "x-w3kits-plugin-id": session.pluginId || W3KITS_PLUGIN_ID,
    "x-w3kits-plugin-version": session.pluginVersion
  };
  if (contentType) headers["Content-Type"] = contentType;
  for (const [key, value] of Object.entries(session.identityHeaders || {})) {
    if (typeof value === "string" && value) headers[key] = value;
  }
  if (session.packageName) headers["x-w3kits-plugin-package"] = session.packageName;
  if (session.packageIntegrity) headers["x-w3kits-plugin-integrity"] = session.packageIntegrity;
  return headers;
}
async function readW3KitsStorage(runtime: RuntimeLike, path: string): Promise<StorageReadResult | null> {
  try {
    const session = await getW3KitsRuntimeSession(runtime);
    const storage = w3kitsObjectStorage(session);
    const response = await runtime.fetch(w3kitsObjectUrl(runtime, storage, path), {
      headers: w3kitsObjectHeaders(session)
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await response.text().catch(() => "w3kits_storage_read_failed"));
    return { body: await response.text() };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function readW3KitsBinaryStorage(runtime: RuntimeLike, path: string): Promise<StorageBinaryReadResult | null> {
  try {
    const session = await getW3KitsRuntimeSession(runtime);
    const storage = w3kitsObjectStorage(session);
    const response = await runtime.fetch(w3kitsObjectUrl(runtime, storage, path), {
      headers: w3kitsObjectHeaders(session)
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(await response.text().catch(() => "w3kits_storage_read_failed"));
    return { body: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? undefined };
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function writeW3KitsStorage(runtime: RuntimeLike, path: string, body: string, contentType: string): Promise<void> {
  const session = await getW3KitsRuntimeSession(runtime);
  const storage = w3kitsObjectStorage(session);
  const response = await runtime.fetch(w3kitsObjectUrl(runtime, storage, path, { formatJson: true }), {
    method: "PUT",
    headers: w3kitsObjectHeaders(session, contentType),
    body
  });
  if (!response.ok) throw new Error(await response.text().catch(() => "w3kits_storage_write_failed"));
}

async function writeW3KitsBinaryStorage(runtime: RuntimeLike, path: string, body: Uint8Array, contentType: string): Promise<void> {
  const session = await getW3KitsRuntimeSession(runtime);
  const storage = w3kitsObjectStorage(session);
  const response = await runtime.fetch(w3kitsObjectUrl(runtime, storage, path, { formatJson: true }), {
    method: "PUT",
    headers: w3kitsObjectHeaders(session, contentType),
    body: bytesToArrayBuffer(body)
  });
  if (!response.ok) throw new Error(await response.text().catch(() => "w3kits_storage_write_failed"));
}

async function syncW3KitsStorage(runtime: RuntimeLike): Promise<void> {
  const session = await getW3KitsRuntimeSession(runtime);
  const storage = w3kitsObjectStorage(session);
  const response = await runtime.fetch(w3kitsObjectUrl(runtime, storage, "", { sync: true }), {
    method: "POST",
    headers: w3kitsObjectHeaders(session)
  });
  if (!response.ok) throw new Error(await response.text().catch(() => "w3kits_storage_sync_failed"));
}

async function getW3KitsRuntimeSession(runtime: RuntimeLike): Promise<W3KitsRuntimeSession> {
  const now = Date.now();
  if (cachedRuntimeSession && cachedRuntimeSession.expiresAt - now > 30_000) {
    return cachedRuntimeSession.value;
  }

  const session = await bridgeRequest<W3KitsRuntimeSession>(runtime, {
    type: W3KITS_RUNTIME_SESSION_REQUEST,
    pluginId: W3KITS_PLUGIN_ID,
    origin: runtime.location.origin
  });

  cachedRuntimeSession = {
    value: session,
    expiresAt: now + Math.max(30, session.expiresIn - 30) * 1000
  };
  return session;
}

async function getW3KitsOpenAiHeaders(runtime: RuntimeLike): Promise<Record<string, string>> {
  const session = await getW3KitsRuntimeSession(runtime);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-w3kits-runtime-session": session.token,
    "x-w3kits-plugin-id": session.pluginId || W3KITS_PLUGIN_ID,
    "x-w3kits-plugin-version": session.pluginVersion
  };

  for (const [key, value] of Object.entries(session.identityHeaders || {})) {
    if (typeof value === "string" && value) {
      headers[key] = value;
    }
  }

  if (session.packageName) {
    headers["x-w3kits-plugin-package"] = session.packageName;
  }
  if (session.packageIntegrity) {
    headers["x-w3kits-plugin-integrity"] = session.packageIntegrity;
  }

  return headers;
}

async function generateRecordViaW3Kits(
  runtime: RuntimeLike,
  requestBody: GenerateImageRequest | EditImageRequest,
  mode: "generate" | "edit"
): Promise<GenerationRecord> {
  const response =
    mode === "edit"
      ? await editImagesViaW3Kits(runtime, requestBody as EditImageRequest)
      : await generateImagesViaW3Kits(runtime, requestBody as GenerateImageRequest);
  const createdAt = new Date().toISOString();
  const mimeType = outputMimeType(requestBody.outputFormat);

  const outputs: GenerationOutput[] = await Promise.all(
    response.images.map(async (image, index) => {
      const assetId = crypto.randomUUID();
      const fileName = `${assetId}.${outputFileExtension(requestBody.outputFormat)}`;
      const body = base64ToBytes(image.b64Json);
      const dataUrl = `data:${mimeType};base64,${image.b64Json}`;
      const dimensions = await readImageDimensions(dataUrl);
      const asset: GeneratedAsset = {
        id: assetId,
        url: `/api/assets/${encodeURIComponent(assetId)}`,
        fileName,
        mimeType,
        width: dimensions.width,
        height: dimensions.height
      };

      await writeStoredAssetRecord(runtime, {
        id: assetId,
        fileName,
        mimeType,
        width: dimensions.width,
        height: dimensions.height,
        bodyKey: assetBodyPath(assetId, requestBody.outputFormat),
        bodyEncoding: "base64",
        size: body.byteLength,
        createdAt
      }, body);

      return {
        id: `${requestBody.clientRequestId ?? crypto.randomUUID()}-output-${index + 1}`,
        status: "succeeded",
        asset
      };
    })
  );

  return {
    id: requestBody.clientRequestId ?? crypto.randomUUID(),
    mode,
    prompt: requestBody.prompt.trim(),
    effectivePrompt: effectivePromptForRequest(requestBody),
    presetId: requestBody.presetId,
    size: requestBody.size,
    quality: requestBody.quality,
    outputFormat: requestBody.outputFormat,
    count: requestBody.count,
    status: outputs.length > 0 ? "succeeded" : "failed",
    referenceAssetIds: "referenceAssetIds" in requestBody ? requestBody.referenceAssetIds : undefined,
    referenceAssetId: "referenceAssetId" in requestBody ? requestBody.referenceAssetId : undefined,
    createdAt,
    outputs,
    error: outputs.length > 0 ? undefined : "No images were generated."
  };
}

async function generateImagesViaW3Kits(runtime: RuntimeLike, requestBody: GenerateImageRequest): Promise<{ images: Array<{ b64Json: string }> }> {
  if (!isW3KitsRuntime(runtime)) {
    throw new Error("Image generation fallback requires the embedded plugin runtime.");
  }

  const response = await runtime.fetch(`${getDefaultOpenAiBaseUrl()}/images/generations`, {
    method: "POST",
    headers: await getW3KitsOpenAiHeaders(runtime),
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: effectivePromptForRequest(requestBody),
      size: `${requestBody.size.width}x${requestBody.size.height}`,
      quality: requestBody.quality,
      output_format: requestBody.outputFormat,
      n: requestBody.count
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw toGenerationError(payload, response.status);
  }

  return { images: await normalizeOpenAiImageResponse(runtime, payload) };
}

async function editImagesViaW3Kits(runtime: RuntimeLike, requestBody: EditImageRequest): Promise<{ images: Array<{ b64Json: string }> }> {
  if (!isW3KitsRuntime(runtime)) {
    throw new Error("Image editing fallback requires the embedded plugin runtime.");
  }

  const references = requestBody.referenceImages?.length
    ? requestBody.referenceImages
    : requestBody.referenceImage
      ? [requestBody.referenceImage]
      : [];
  if (references.length === 0) {
    throw new Error("At least one reference image is required.");
  }

  const formData = new FormData();
  formData.append("model", IMAGE_MODEL);
  formData.append("prompt", effectivePromptForRequest(requestBody));
  formData.append("size", `${requestBody.size.width}x${requestBody.size.height}`);
  formData.append("quality", requestBody.quality);
  formData.append("output_format", requestBody.outputFormat);
  formData.append("n", String(requestBody.count));

  for (const [index, reference] of references.entries()) {
    const file = dataUrlToFile(reference.dataUrl, reference.fileName || `reference-${index + 1}.png`);
    formData.append("image", file, file.name);
  }

  const headers = await getW3KitsOpenAiHeaders(runtime);
  delete headers["Content-Type"];

  const response = await runtime.fetch(`${getDefaultOpenAiBaseUrl()}/images/edits`, {
    method: "POST",
    headers,
    body: formData
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw toGenerationError(payload, response.status);
  }

  return { images: await normalizeOpenAiImageResponse(runtime, payload) };
}

function effectivePromptForRequest(requestBody: GenerateImageRequest | EditImageRequest): string {
  const prompt = requestBody.prompt.trim();
  const preset = STYLE_PRESETS.find((item) => item.id === requestBody.presetId);
  if (!preset || preset.id === "none" || !preset.prompt) {
    return prompt;
  }

  return `${prompt}\n\nStyle direction: ${preset.prompt}`;
}

async function normalizeOpenAiImageResponse(runtime: RuntimeLike, payload: unknown): Promise<Array<{ b64Json: string }>> {
  const data = isRecord(payload) && Array.isArray(payload.data) ? payload.data : [];
  const images = await Promise.all(
    data.map(async (item) => {
      if (!isRecord(item)) {
        return null;
      }

      return imageFromOpenAiResponseItem(runtime, item);
    })
  );
  const normalizedImages = images.filter((image): image is { b64Json: string } => Boolean(image?.b64Json));

  if (normalizedImages.length === 0) {
    throw new Error(`OpenAI image response did not include usable image data. ${describeOpenAiImageResponse(payload)}`);
  }

  return normalizedImages;
}

async function imageFromOpenAiResponseItem(runtime: RuntimeLike, item: Record<string, unknown>): Promise<{ b64Json: string } | null> {
  const b64Json = readOpenAiImageBase64(item);
  if (b64Json) {
    return { b64Json };
  }

  const url = readOpenAiImageUrl(item);
  if (!url) {
    return null;
  }

  return { b64Json: await downloadOpenAiImageUrl(runtime, url) };
}

function readOpenAiImageBase64(value: unknown, depth = 0): string | undefined {
  if (depth > 4 || value == null) return undefined;
  if (typeof value === "string") {
    if (value.startsWith("data:image/")) return imageDataUrlToBase64(value);
    return isLikelyBase64Image(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = readOpenAiImageBase64(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  for (const key of ["b64_json", "b64Json", "base64", "image_base64", "imageBase64", "data"]) {
    const raw = readStringValue(value[key]);
    if (raw?.startsWith("data:image/")) return imageDataUrlToBase64(raw);
    if (raw && isLikelyOpenAiBase64Payload(raw)) return raw.trim();
  }

  for (const key of ["image", "image_url", "imageUrl", "content", "output", "result", "results"]) {
    const found = readOpenAiImageBase64(value[key], depth + 1);
    if (found) return found;
  }

  return undefined;
}

function readOpenAiImageUrl(value: unknown, depth = 0): string | undefined {
  if (depth > 4 || value == null) return undefined;
  if (typeof value === "string") {
    return isOpenAiDownloadableImageUrl(value) ? value : undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = readOpenAiImageUrl(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  for (const key of ["url", "image_url", "imageUrl", "src"]) {
    const raw = readStringValue(value[key]);
    if (raw && isOpenAiDownloadableImageUrl(raw)) return raw;
  }

  for (const key of ["image", "content", "output", "result", "results"]) {
    const found = readOpenAiImageUrl(value[key], depth + 1);
    if (found) return found;
  }

  return undefined;
}

function isLikelyBase64Image(value: string): boolean {
  const trimmed = value.trim();
  if (!isLikelyOpenAiBase64Payload(trimmed)) return false;
  return trimmed.length >= 32;
}

function isLikelyOpenAiBase64Payload(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("data:image/")) return false;
  if (/^https?:\/\//iu.test(trimmed)) return false;
  if (trimmed.length < 8 || trimmed.length % 4 !== 0) return false;
  return /^[A-Za-z0-9+/]+={0,2}$/u.test(trimmed);
}

function isOpenAiDownloadableImageUrl(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("data:image/") || Boolean(parseOpenAiImageUrl(trimmed));
}

async function downloadOpenAiImageUrl(runtime: RuntimeLike, url: string): Promise<string> {
  const parsedUrl = parseOpenAiImageUrl(url);
  if (!parsedUrl) {
    throw new Error("OpenAI image response included an unsupported image URL.");
  }

  if (parsedUrl.protocol === "data:") {
    return imageDataUrlToBase64(url);
  }

  const response = await runtime.fetch(parsedUrl);
  if (!response.ok) {
    throw new Error(`OpenAI image URL download failed with ${response.status}.`);
  }

  const contentType = response.headers.get("content-type");
  if (!isOpenAiImageContentType(contentType)) {
    throw new Error("OpenAI image URL returned non-image content.");
  }

  const contentLength = parseContentLength(response.headers.get("content-length"));
  if (contentLength !== undefined && contentLength > MAX_OPENAI_IMAGE_BYTES) {
    throw new Error("OpenAI image URL returned an image that is too large.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_OPENAI_IMAGE_BYTES) {
    throw new Error("OpenAI image URL returned an image that is too large.");
  }
  if (!isOpenAiImageBytes(bytes)) {
    throw new Error("OpenAI image URL returned unrecognized image content.");
  }

  return bytesToBase64(bytes);
}

function parseOpenAiImageUrl(url: string): URL | undefined {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:" || parsedUrl.protocol === "data:" ? parsedUrl : undefined;
  } catch {
    return undefined;
  }
}

function imageDataUrlToBase64(url: string): string {
  const match = /^data:image\/[^;,]+;base64,(.+)$/u.exec(url);
  if (!match) {
    throw new Error("OpenAI image response included an unsupported data URL.");
  }

  return match[1] ?? "";
}

function isOpenAiImageContentType(value: string | null): boolean {
  if (!value) {
    return true;
  }

  const contentType = value.split(";")[0]?.trim().toLowerCase();
  return Boolean(contentType?.startsWith("image/") || contentType === "application/octet-stream");
}

function isOpenAiImageBytes(bytes: Uint8Array): boolean {
  return isPng(bytes) || isJpeg(bytes) || isWebp(bytes);
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isWebp(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function parseContentLength(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function describeOpenAiImageResponse(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return "Response did not include a data array.";
  }

  const itemDescriptions = payload.data.slice(0, 3).map((item, index) => {
    if (!isRecord(item)) {
      return `data[${index}] is ${typeof item}`;
    }

    const keys = Object.keys(item).sort();
    return `data[${index}] keys: ${keys.length > 0 ? keys.join(", ") : "none"}`;
  });
  return itemDescriptions.length > 0 ? itemDescriptions.join("; ") : "Response data array was empty.";
}

function toGenerationError(payload: unknown, status: number): Error {
  if (isLoginRequiredPayload(payload, status)) {
    return new Error("Sign in required before using the OpenAI-compatible provider.");
  }

  const message =
    isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
      ? payload.error.message
      : `Image request failed with ${status}.`;
  return new Error(message);
}

function isLoginRequiredPayload(payload: unknown, status: number): boolean {
  if (status === 401) {
    return true;
  }

  if (!isRecord(payload)) {
    return false;
  }

  const error = isRecord(payload.error) ? payload.error : payload;
  const code = typeof error.code === "string" ? error.code : "";
  return code === "login_required" || code === "plugin_runtime_session_required" || code === "invalid_plugin_runtime_session";
}

function isLoginRequiredError(error: unknown): boolean {
  return error instanceof Error && error.message.toLowerCase().includes("sign in required");
}

function outputMimeType(outputFormat: GenerateImageRequest["outputFormat"]): string {
  if (outputFormat === "jpeg") {
    return "image/jpeg";
  }
  if (outputFormat === "webp") {
    return "image/webp";
  }
  return "image/png";
}

function outputFileExtension(outputFormat: GenerateImageRequest["outputFormat"]): string {
  return outputFormat === "jpeg" ? "jpg" : outputFormat;
}

async function deleteStoredAssetRecord(runtime: RuntimeLike, assetId: string): Promise<void> {
  deleteAssetRecordCache(assetId);
  if (isW3KitsRuntime(runtime)) {
    await deleteW3KitsStorage(runtime, assetRecordPath(assetId)).catch(() => undefined);
    await syncW3KitsStorage(runtime).catch(() => undefined);
  }
  await deleteAssetBodyL1(assetId).catch(() => undefined);
  await deleteAssetRecordL1(assetId).catch(() => undefined);
  runtime.localStorage.removeItem(`gpt-image-canvas.asset.${assetId}`);
  runtime.localStorage.removeItem(`gpt-image-canvas.asset-body.${assetId}`);
}

async function readImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  if (typeof window === "undefined") {
    return { width: 1024, height: 1024 };
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth || 1024, height: image.naturalHeight || 1024 });
    image.onerror = () => reject(new Error("Failed to read generated image dimensions."));
    image.src = dataUrl;
  });
}

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) {
    throw new Error("Reference image data URL is invalid.");
  }

  const mimeType = match[1] ?? "application/octet-stream";
  const body = match[2] ?? "";
  return new File([bytesToArrayBuffer(base64ToBytes(body))], fileName, { type: mimeType });
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const match = /^data:([^;,]+);base64,(.+)$/u.exec(dataUrl);
  if (!match) {
    throw new Error("Stored asset data URL is invalid.");
  }

  return base64ToBytes(match[2] ?? "");
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function assetRecordPath(assetId: string): string {
  return `${W3KITS_ASSET_DIR}/${assetId}.json`;
}

function assetBodyPath(assetId: string, outputFormat: GenerateImageRequest["outputFormat"]): string {
  return `${W3KITS_ASSET_DIR}/${assetId}.${outputFileExtension(outputFormat)}`;
}

async function writeStoredAssetBody(runtime: RuntimeLike, record: StoredAssetRecord, body: Uint8Array): Promise<void> {
  await writeAssetBodyL1(record.id, body, record.mimeType).catch(() => undefined);
  if (isW3KitsRuntime(runtime)) {
    void writeW3KitsBinaryStorage(runtime, record.bodyKey || assetBodyPath(record.id, "png"), body, record.mimeType).catch(() => undefined);
    return;
  }

  runtime.localStorage.setItem("gpt-image-canvas.asset-body." + record.id, bytesToBase64(body));
}

async function writeStoredAssetRecord(runtime: RuntimeLike, record: StoredAssetRecord, body?: Uint8Array): Promise<void> {
  writeAssetRecordCache(record, body);
  await writeAssetRecordL1(record).catch(() => undefined);
  if (body) {
    await writeStoredAssetBody(runtime, record, body).catch(() => undefined);
  }
  if (isW3KitsRuntime(runtime)) {
    void writeJsonState(runtime, "gpt-image-canvas.asset." + record.id, assetRecordPath(record.id), record, { sync: false })
      .catch(() => undefined);
    return;
  }

  await writeJsonState(runtime, "gpt-image-canvas.asset." + record.id, assetRecordPath(record.id), record);
}

async function readStoredAssetRecord(runtime: RuntimeLike, assetId: string): Promise<StoredAssetRecord | null> {
  return readAssetRecordCache(assetId) ?? await readAssetRecordL1(assetId).catch(() => null) ?? readJsonState<StoredAssetRecord | null>(runtime, "gpt-image-canvas.asset." + assetId, assetRecordPath(assetId), null);
}

async function readStoredAssetBody(runtime: RuntimeLike, record: StoredAssetRecord): Promise<Uint8Array> {
  const cached = readAssetBodyCache(record.id);
  if (cached) return cached;
  if (record.dataUrl) return dataUrlToBytes(record.dataUrl);

  const localBody = await readAssetBodyL1(record.id).catch(() => null);
  if (localBody) {
    writeAssetRecordCache(record, localBody);
    return localBody;
  }

  if (isW3KitsRuntime(runtime) && record.bodyKey) {
    const entry = await readW3KitsBinaryStorage(runtime, record.bodyKey);
    if (entry?.body) {
      writeAssetRecordCache(record, entry.body);
      return entry.body;
    }
  }

  const localStorageBody = runtime.localStorage.getItem("gpt-image-canvas.asset-body." + record.id);
  if (localStorageBody) {
    const body = base64ToBytes(localStorageBody);
    writeAssetRecordCache(record, body);
    return body;
  }

  throw new Error("Stored asset body is unavailable.");
}

async function deleteW3KitsStorage(runtime: RuntimeLike, path: string): Promise<void> {
  const session = await getW3KitsRuntimeSession(runtime);
  const storage = w3kitsObjectStorage(session);
  const response = await runtime.fetch(w3kitsObjectUrl(runtime, storage, path, { formatJson: true }), {
    method: "DELETE",
    headers: w3kitsObjectHeaders(session)
  });
  if (response.status === 404) return;
  if (!response.ok) throw new Error(await response.text().catch(() => "w3kits_storage_delete_failed"));
}

const CRC32_TABLE = buildCrc32Table();

function buildStoredZipArchive(files: Array<{ name: string; bytes: Uint8Array }>): Uint8Array {
  const textEncoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const fileName = textEncoder.encode(file.name);
    const crc = crc32(file.bytes);
    const localHeader = new Uint8Array(30 + fileName.length);
    const localView = new DataView(localHeader.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, fileName.length, true);
    localView.setUint16(28, 0, true);
    localHeader.set(fileName, 30);
    localParts.push(localHeader, file.bytes);

    const centralHeader = new Uint8Array(46 + fileName.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, fileName.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(fileName, 46);
    centralParts.push(centralHeader);

    offset += localHeader.length + file.bytes.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  return concatBytes([...localParts, ...centralParts, end]);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = (CRC32_TABLE[(value ^ byte) & 0xff] ?? 0) ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}
