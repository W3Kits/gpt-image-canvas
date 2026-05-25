import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { handleW3KitsApiRequest } from "../../apps/web/src/lib/w3kits-runtime.js";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 7462;
const STATIC_ROOT = process.cwd();
const DATA_ROOT = process.env.W3KITS_DATA_DIR || "/home/agent/.config/gpt-image-canvas";
const OBJECT_FACADE_ENDPOINT = process.env.W3KITS_OBJECT_FACADE_ENDPOINT || "";
const OBJECT_FACADE_BUCKET = process.env.W3KITS_OBJECT_FACADE_BUCKET || "";

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css;charset=UTF-8",
  ".html": "text/html;charset=UTF-8",
  ".js": "text/javascript;charset=UTF-8",
  ".json": "application/json;charset=UTF-8",
  ".mjs": "text/javascript;charset=UTF-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain;charset=UTF-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

type Listener = (event: { source: object; origin: string; data: unknown }) => void;
type BridgeMessage = { type?: string; requestId?: string; path?: string; body?: string };

class FileBackedStorage {
  #cache = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#cache.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#cache.set(key, value);
  }

  removeItem(key: string): void {
    this.#cache.delete(key);
  }
}

const localStorage = new FileBackedStorage();
const listeners = new Set<Listener>();
const parentWindow = {
  postMessage(message: BridgeMessage, targetOrigin: string) {
    void handleBridgeMessage(message, targetOrigin);
  },
};

const windowLike = {
  parent: parentWindow,
  addEventListener(type: string, listener: Listener) {
    if (type === "message") listeners.add(listener);
  },
  removeEventListener(type: string, listener: Listener) {
    if (type === "message") listeners.delete(listener);
  },
  setTimeout,
  clearTimeout,
  location: {
    href: "",
    origin: "",
    search: "",
  },
};

const navigatorLike = { language: "en", languages: ["en"] };
const documentLike = { documentElement: { lang: "en" } };

Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: windowLike,
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: navigatorLike,
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: documentLike,
});

if (typeof (globalThis as { Image?: unknown }).Image === "undefined") {
  class FakeImage {
    naturalWidth = 1024;
    naturalHeight = 1024;
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;

    set src(_value: string) {
      queueMicrotask(() => this.onload?.());
    }
  }

  Object.assign(globalThis, { Image: FakeImage });
}

function parseArgs(argv: string[]) {
  const options = { host: DEFAULT_HOST, port: DEFAULT_PORT };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--host" && argv[index + 1]) {
      options.host = argv[++index] || DEFAULT_HOST;
    } else if (value === "--port" && argv[index + 1]) {
      const parsed = Number(argv[++index]);
      options.port = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_PORT;
    }
  }
  return options;
}

function objectFacadeAvailable(): boolean {
  return Boolean(OBJECT_FACADE_ENDPOINT && OBJECT_FACADE_BUCKET && process.env.W3KITS_RUNTIME_SESSION);
}


async function handleBridgeMessage(message: BridgeMessage, targetOrigin: string): Promise<void> {
  const response = await createBridgeResponse(message);
  queueMicrotask(() => {
    for (const listener of listeners) {
      listener({
        source: parentWindow,
        origin: targetOrigin,
        data: response,
      });
    }
  });
}

async function createBridgeResponse(message: BridgeMessage): Promise<unknown> {
  const requestId = message.requestId;
  const ok = (data: unknown) => ({ type: "W3KITS_RESPONSE", requestId, ok: true, data });
  const error = (code: string, messageText: string) => ({
    type: "W3KITS_RESPONSE",
    requestId,
    ok: false,
    error: { code, message: messageText },
  });

  try {
    switch (message.type) {
      case "W3KITS_RUNTIME_SESSION_REQUEST":
        return ok({
          token: process.env.W3KITS_RUNTIME_SESSION || "",
          expiresIn: 300,
          pluginId: process.env.W3KITS_PLUGIN_ID || "gpt-image-canvas",
          pluginVersion: process.env.W3KITS_PLUGIN_VERSION || "",
          packageName: process.env.W3KITS_PLUGIN_PACKAGE || "",
          packageIntegrity: process.env.W3KITS_PLUGIN_INTEGRITY || "",
          openaiBaseUrl: process.env.W3KITS_OPENAI_BASE_URL || "https://w3kits.com/api/ai/openai/v1",
          runtimeSessionHeader: "x-w3kits-runtime-session",
          identityHeaders: {
            "x-w3kits-plugin-id": process.env.W3KITS_PLUGIN_ID || "gpt-image-canvas",
            "x-w3kits-plugin-version": process.env.W3KITS_PLUGIN_VERSION || "",
          },
          storage: objectFacadeAvailable() ? {
            type: "w3kits-vfs-object-facade",
            endpoint: OBJECT_FACADE_ENDPOINT,
            bucket: OBJECT_FACADE_BUCKET,
            visibleConfigDir: DATA_ROOT,
            auth: { mode: "runtime-bearer", header: "x-w3kits-runtime-session" },
          } : undefined,
        });
      default:
        return ok({ ok: true });
    }
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException)?.code === "ENOENT") {
      return error("not_found", "not_found");
    }
    return error("bridge_failed", caught instanceof Error ? caught.message : String(caught));
  }
}

function requestUrl(request: IncomingMessage): URL {
  const host = request.headers.host || `127.0.0.1:${DEFAULT_PORT}`;
  return new URL(request.url || "/", `http://${host}`);
}

async function readRequestBody(request: IncomingMessage): Promise<Uint8Array> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new Uint8Array(Buffer.concat(chunks));
}

function safeStaticPath(pathname: string): string | null {
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(STATIC_ROOT, `.${normalized}`);
  return resolved.startsWith(STATIC_ROOT) ? resolved : null;
}

async function serveStatic(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = requestUrl(request);
  const staticResponse = await staticResponseForUrl(url, request.method || "GET");
  const headers: Record<string, string> = {};
  staticResponse.headers.forEach((value, key) => {
    headers[key] = value;
  });
  response.writeHead(staticResponse.status, headers);
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  response.end(Buffer.from(await staticResponse.arrayBuffer()));
}

async function staticResponseForUrl(url: URL, method: string): Promise<Response> {
  const requestedPath = safeStaticPath(decodeURIComponent(url.pathname));
  if (!requestedPath) {
    return new Response(JSON.stringify({ error: { code: "invalid_path", message: "Invalid path." } }), {
      status: 400,
      headers: { "content-type": "application/json;charset=UTF-8" },
    });
  }

  try {
    const fileStat = await stat(requestedPath);
    const target = fileStat.isDirectory() ? path.join(requestedPath, "index.html") : requestedPath;
    const body = await readFile(target);
    return new Response(method === "HEAD" ? null : body, {
      status: 200,
      headers: {
        "content-type": CONTENT_TYPES[path.extname(target)] || "application/octet-stream",
        "cache-control": target.endsWith(".html") ? "no-store" : "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    try {
      const fallback = await readFile(path.join(STATIC_ROOT, "index.html"));
      return new Response(method === "HEAD" ? null : fallback, {
        status: 200,
        headers: {
          "content-type": "text/html;charset=UTF-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      return new Response(JSON.stringify({ error: { code: "not_found", message: "Not found." } }), {
        status: 404,
        headers: { "content-type": "application/json;charset=UTF-8" },
      });
    }
  }
}

async function daemonFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = input instanceof Request ? input : undefined;
  const method = (init?.method || request?.method || "GET").toUpperCase();
  const rawUrl = request?.url || String(input);
  const baseUrl = windowLike.location.href || `http://127.0.0.1:${DEFAULT_PORT}/`;
  let url: URL;
  try {
    url = new URL(rawUrl, baseUrl);
  } catch {
    return globalThis.fetch(input, init);
  }

  const sameOrigin = !windowLike.location.origin || url.origin === windowLike.location.origin;
  if (sameOrigin && !url.pathname.startsWith("/api/") && (method === "GET" || method === "HEAD")) {
    return staticResponseForUrl(url, method);
  }

  return globalThis.fetch(input, init);
}

function syncWindowLocation(url: URL): void {
  const parentOrigin = process.env.W3KITS_PARENT_ORIGIN || "https://w3kits.com";
  const openaiBaseUrl = process.env.W3KITS_OPENAI_BASE_URL || "https://w3kits.com/api/ai/openai/v1";
  const pluginId = process.env.W3KITS_PLUGIN_ID || "gpt-image-canvas";
  const pluginVersion = process.env.W3KITS_PLUGIN_VERSION || "";
  const packageName = process.env.W3KITS_PLUGIN_PACKAGE || "";
  const packageIntegrity = process.env.W3KITS_PLUGIN_INTEGRITY || "";
  const next = new URL(url.toString());
  next.searchParams.set("w3kitsParentOrigin", parentOrigin);
  next.searchParams.set("openaiBaseUrl", openaiBaseUrl);
  next.searchParams.set("w3kitsPluginId", pluginId);
  if (pluginVersion) next.searchParams.set("w3kitsPluginVersion", pluginVersion);
  if (packageName) next.searchParams.set("w3kitsPluginPackage", packageName);
  if (packageIntegrity) next.searchParams.set("w3kitsPluginIntegrity", packageIntegrity);
  windowLike.location.href = next.toString();
  windowLike.location.origin = next.origin;
  windowLike.location.search = next.search;
}

async function route(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = requestUrl(request);
  syncWindowLocation(url);
  if (url.pathname.startsWith("/api/")) {
    const body = await readRequestBody(request);
    const apiRequest = new Request(url, {
      method: request.method || "GET",
      headers: request.headers as HeadersInit,
      body: (body.byteLength > 0 ? Buffer.from(body) : undefined) as BodyInit | undefined,
    } as RequestInit);
    const runtime = {
      fetch: daemonFetch,
      location: windowLike.location,
      localStorage,
      navigator: navigatorLike,
      document: documentLike,
    } as unknown as Parameters<typeof handleW3KitsApiRequest>[1];
    const apiResponse = await handleW3KitsApiRequest(apiRequest, runtime);
    if (apiResponse) {
      const headers: Record<string, string> = {};
      apiResponse.headers.forEach((value, key) => {
        headers[key] = value;
      });
      response.writeHead(apiResponse.status, headers);
      response.end(Buffer.from(await apiResponse.arrayBuffer()));
      return;
    }
  }

  await serveStatic(request, response);
}

const { host, port } = parseArgs(process.argv.slice(2));
await mkdir(DATA_ROOT, { recursive: true });

const server = createServer((request, response) => {
  void route(request, response).catch((error) => {
    response.writeHead(500, { "content-type": "application/json;charset=UTF-8" });
    response.end(
      JSON.stringify({
        error: {
          code: "daemon_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      }),
    );
  });
});

server.listen(port, host, () => {
  console.log(`[gpt-image-canvas] listening on http://${host}:${port}`);
});
