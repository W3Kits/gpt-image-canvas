const DEFAULT_RUNTIME_MANIFEST_PATH = "__w3kits/webcontainer-runtime.json";
const DEFAULT_DAEMON_PORT = 7462;

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
  return {
    webcontainer,
    process,
    daemonUrl: decorateDaemonUrl(daemonUrl, env),
    runtime,
  };
}
