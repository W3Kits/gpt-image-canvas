const DEFAULT_RUNTIME_MANIFEST_PATH = "__w3kits/webcontainer-runtime.json";
const DEFAULT_DAEMON_PORT = 7462;
const DEFAULT_DATA_DIR = "/home/agent/.config/gpt-image-canvas";

function pathJoin(...parts) {
  const joined = parts.filter(Boolean).join("/");
  const absolute = joined.startsWith("/");
  const segments = [];
  for (const part of joined.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return (absolute ? "/" : "") + segments.join("/");
}

function parentPath(filePath) {
  const normalized = filePath.replace(/\/+$/, "");
  const index = normalized.lastIndexOf("/");
  return index > 0 ? normalized.slice(0, index) : "/";
}

function relativePath(root, filePath) {
  const normalizedRoot = root.replace(/\/+$/, "");
  return filePath === normalizedRoot ? "" : filePath.slice(normalizedRoot.length + 1);
}

function bytesSignature(bytes) {
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return bytes.byteLength + ":" + (hash >>> 0).toString(16);
}

function assertCrossOriginIsolated() {
  if (typeof globalThis.crossOriginIsolated !== "undefined" && !globalThis.crossOriginIsolated) {
    throw new Error("w3kits_webcontainer_requires_cross_origin_isolation");
  }
}

async function loadRuntimeManifest(manifestPath = DEFAULT_RUNTIME_MANIFEST_PATH, options = {}) {
  if (options.runtimeManifest) return options.runtimeManifest;
  const response = await fetch(manifestPath, { cache: "force-cache" });
  if (!response.ok) throw new Error("w3kits_webcontainer_manifest_unavailable");
  return response.json();
}

async function waitForServerReady(webcontainer, expectedPort, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("w3kits_gpt_image_canvas_daemon_start_timeout")), timeoutMs);
    const dispose = webcontainer.on("server-ready", (port, url) => {
      if (port !== expectedPort) return;
      clearTimeout(timeout);
      dispose?.();
      resolve(url);
    });
  });
}

function mergeEnv(runtime, inputEnv = {}) {
  return {
    ...inputEnv,
    HOME: inputEnv.HOME || "/home/agent",
    W3KITS_USER_HOME: inputEnv.W3KITS_USER_HOME || "/home/agent",
    W3KITS_WEBCONTAINER: "1",
    W3KITS_LOCALE: inputEnv.W3KITS_LOCALE || "en",
    W3KITS_OPENAI_BASE_URL: inputEnv.W3KITS_OPENAI_BASE_URL || runtime.ai?.openaiBaseUrl || "",
    W3KITS_RUNTIME_SESSION: inputEnv.W3KITS_RUNTIME_SESSION || "",
    W3KITS_PLUGIN_ID: inputEnv.W3KITS_PLUGIN_ID || runtime.pluginId || "gpt-image-canvas",
    W3KITS_PLUGIN_VERSION: inputEnv.W3KITS_PLUGIN_VERSION || "",
    W3KITS_PLUGIN_PACKAGE: inputEnv.W3KITS_PLUGIN_PACKAGE || "",
    W3KITS_PLUGIN_INTEGRITY: inputEnv.W3KITS_PLUGIN_INTEGRITY || "",
  };
}

function decorateDaemonUrl(url, env) {
  const next = new URL(url);
  next.searchParams.set("w3kitsLocale", env.W3KITS_LOCALE || "en");
  next.searchParams.set("w3kitsParentOrigin", globalThis.location?.origin || "https://w3kits.com");
  next.searchParams.set("w3kitsPluginId", env.W3KITS_PLUGIN_ID || "gpt-image-canvas");
  if (env.W3KITS_OPENAI_BASE_URL) {
    next.searchParams.set("openaiBaseUrl", env.W3KITS_OPENAI_BASE_URL);
  }
  return next.toString();
}

async function listFiles(webcontainer, root) {
  const files = [];
  async function walk(dir) {
    let entries;
    try {
      entries = await webcontainer.fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = typeof entry.name === "string" ? entry.name : new TextDecoder().decode(entry.name);
      const next = pathJoin(dir, name);
      if (entry.isDirectory?.()) {
        await walk(next);
      } else if (entry.isFile?.()) {
        files.push(next);
      }
    }
  }
  await walk(root);
  return files;
}

async function ensureDataDir(webcontainer, runtime, options = {}) {
  const dataDir = runtime.persistence?.dataDir || DEFAULT_DATA_DIR;
  try {
    await webcontainer.fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    options.onError?.(error);
  }
}

function shouldPersistFile(runtime, dataDir, filePath) {
  const rel = relativePath(dataDir, filePath);
  if (!rel || rel.startsWith("node_modules/") || rel.includes("/node_modules/")) return false;
  const includes = runtime.persistence?.include || [];
  if (!includes.length) return true;
  return includes.some((pattern) => {
    if (pattern.endsWith("/**")) return rel === pattern.slice(0, -3) || rel.startsWith(pattern.slice(0, -2));
    return rel === pattern;
  });
}

function diskFilesEndpoint(runtime, options) {
  if (options.diskFilesEndpoint) return options.diskFilesEndpoint;
  const pluginId = options.pluginId || runtime.pluginId || "gpt-image-canvas";
  return `/api/plugins/${encodeURIComponent(pluginId)}/webcontainer/disk/files`;
}

function startWebContainerAutosave(webcontainer, runtime, options = {}) {
  const token = options.r2DiskSession?.token || options.runtimeSession;
  if (!token || typeof fetch !== "function") return { stop() {} };
  const dataDir = runtime.persistence?.dataDir || DEFAULT_DATA_DIR;
  const diskRoot = runtime.persistence?.diskRoot || dataDir;
  const workspaceId = options.r2DiskSession?.workspaceId || options.workspaceId || "default";
  const endpoint = diskFilesEndpoint(runtime, options);
  const intervalMs = runtime.persistence?.flushPolicy?.intervalMs || 30000;
  const seen = new Map();
  let stopped = false;
  let flushing = false;

  async function upload(filePath, bytes) {
    const relativeFilePath = relativePath(dataDir, filePath);
    const url = new URL(endpoint, globalThis.location?.origin || "https://w3kits.com");
    url.searchParams.set("workspaceId", workspaceId);
    url.searchParams.set("path", pathJoin(diskRoot, relativeFilePath));
    const response = await fetch(url.toString(), {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "content-type": "application/octet-stream",
        "x-w3kits-runtime-session": token,
      },
      body: bytes,
    });
    if (!response.ok) throw new Error(`w3kits_disk_autosave_upload_failed:${response.status}:${filePath}`);
  }

  async function flush(reason = "interval") {
    if (stopped || flushing) return;
    flushing = true;
    try {
      const files = await listFiles(webcontainer, dataDir);
      for (const filePath of files) {
        if (!shouldPersistFile(runtime, dataDir, filePath)) continue;
        const bytes = await webcontainer.fs.readFile(filePath);
        const signature = bytesSignature(bytes);
        if (seen.get(filePath) === signature) continue;
        await upload(filePath, bytes);
        seen.set(filePath, signature);
      }
      options.onLog?.(`[w3kits autosave] flushed GPT Image Canvas files (${reason})`);
    } catch (error) {
      options.onError?.(error);
    } finally {
      flushing = false;
    }
  }

  const timer = globalThis.setInterval?.(() => void flush("interval"), intervalMs);
  const lifecycleFlush = () => void flush("lifecycle");
  globalThis.addEventListener?.("visibilitychange", lifecycleFlush);
  globalThis.addEventListener?.("pagehide", lifecycleFlush);
  void flush("startup");
  return {
    flush,
    stop() {
      stopped = true;
      if (timer) globalThis.clearInterval?.(timer);
      globalThis.removeEventListener?.("visibilitychange", lifecycleFlush);
      globalThis.removeEventListener?.("pagehide", lifecycleFlush);
    },
  };
}

export async function bootW3KitsWebContainerPlugin(options = {}) {
  assertCrossOriginIsolated();
  const runtime = await loadRuntimeManifest(options.runtimeManifestPath || DEFAULT_RUNTIME_MANIFEST_PATH, options);
  const WebContainer = options.WebContainer || globalThis.WebContainer;
  if (!WebContainer?.boot) throw new Error("w3kits_webcontainer_api_unavailable");

  const webcontainer = options.webcontainer || await WebContainer.boot(options.bootOptions || {});
  if (options.mountTree) await webcontainer.mount(options.mountTree);
  if (options.mounts) {
    for (const mount of options.mounts) await webcontainer.mount(mount.tree, mount.options);
  }
  await ensureDataDir(webcontainer, runtime, options);

  const env = mergeEnv(runtime, options.env || {});
  const command =
    options.command ||
    runtime.daemon?.startCommand ||
    ["node", "__w3kits/webcontainer-runtime/runtime/daemon/server.js", "--host", "0.0.0.0", "--port", String(DEFAULT_DAEMON_PORT)];
  const process = await webcontainer.spawn(command[0], command.slice(1), { cwd: "/", env });

  process.output?.pipeTo?.(new WritableStream({
    write(chunk) {
      options.onLog?.(String(chunk));
    },
  })).catch((error) => options.onError?.(error));

  const daemonUrl = await waitForServerReady(webcontainer, runtime.daemon?.port || DEFAULT_DAEMON_PORT, options.startTimeoutMs || 30000);
  const autosave = startWebContainerAutosave(webcontainer, runtime, options);
  return {
    webcontainer,
    process,
    daemonUrl: decorateDaemonUrl(daemonUrl, env),
    autosave,
    runtime,
  };
}
