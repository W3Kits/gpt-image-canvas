import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readText(relativePath) {
  const file = path.join(dist, relativePath);
  assert(fs.existsSync(file), `missing ${relativePath}`);
  return fs.readFileSync(file, "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

const launcher = readText("browser-daemon.js");
const runtime = readJson("__w3kits/webcontainer-runtime.json");
const runtimePackage = readJson("__w3kits/webcontainer-runtime/package.json");
const daemonServer = readText("__w3kits/webcontainer-runtime/runtime/daemon/server.js");
const runtimeModule = readText("__w3kits/webcontainer-runtime/apps/web/src/lib/w3kits-runtime.js");

assert(launcher.includes("bootW3KitsWebContainerPlugin"), "browser-daemon.js must export the WebContainer boot adapter");
assert(launcher.includes("w3kits_gpt_image_canvas_daemon_start_timeout"), "browser-daemon.js must declare the GPT Image Canvas start timeout");
assert(launcher.includes("W3KITS_OPENAI_BASE_URL"), "browser-daemon.js must pass the W3Kits OpenAI base URL");
assert(launcher.includes("w3kitsParentOrigin"), "browser-daemon.js must propagate the parent origin");
assert(launcher.includes("w3kitsLocale"), "browser-daemon.js must propagate locale");
assert(launcher.includes("webcontainer.spawn"), "browser-daemon.js must start the daemon through WebContainer spawn");
assert(launcher.includes("server-ready"), "browser-daemon.js must wait for WebContainer server-ready");
assert(
  launcher.includes("__w3kits/webcontainer-runtime/runtime/daemon/server.js"),
  "browser-daemon.js fallback must launch the packaged API daemon server",
);
assert(
  !launcher.includes("__w3kits/webcontainer-runtime/apps/daemon/dist/cli.js"),
  "browser-daemon.js must not fall back to the legacy static-only daemon",
);

assert(runtime.schemaVersion === 1, "runtime manifest schemaVersion must be 1");
assert(runtime.pluginId === "gpt-image-canvas", "runtime manifest pluginId must be gpt-image-canvas");
assert(runtime.mode === "daemon-webcontainer", "runtime manifest mode must be daemon-webcontainer");
assert(runtime.requiresCrossOriginIsolation === true, "runtime manifest must require cross-origin isolation");
assert(runtime.runtimeRoot === "__w3kits/webcontainer-runtime", "runtime manifest must expose the WebContainer runtime root");
assert(runtime.daemon?.entry === "__w3kits/webcontainer-runtime/runtime/daemon/server.js", "runtime manifest must point at the packaged daemon server");
assert(Array.isArray(runtime.daemon?.startCommand), "runtime manifest must include daemon startCommand");
assert(runtime.daemon.startCommand.join(" ").includes("__w3kits/webcontainer-runtime/runtime/daemon/server.js"), "daemon startCommand must launch the packaged daemon server");
assert(runtime.daemon.port === 7462, "runtime manifest must pin port 7462");
assert(runtime.daemon.healthPath === "/api/health", "runtime manifest must pin /api/health");
assert(runtime.ai?.openaiBaseUrl === "https://w3kits.com/api/ai/openai/v1", "runtime manifest must use the W3Kits OpenAI base URL");
assert(runtime.ai?.defaultImageModel === "gpt-image-2", "runtime manifest must declare gpt-image-2 as the default image model");
assert(runtime.persistence?.authority === "w3kits-plugin-user-data", "runtime manifest must declare W3Kits plugin user data persistence");
assert(runtime.persistence?.dataDir === "/home/agent/.config/gpt-image-canvas", "runtime manifest must pin the WebContainer data directory");
assert(runtime.persistence?.diskRoot === "/home/agent/.config/gpt-image-canvas", "runtime manifest must pin the WebContainer disk root");
assert(runtime.persistence?.flushPolicy?.intervalMs === 30000, "runtime manifest must declare the persistence flush interval");
assert(runtime.unsupportedLocalOnlyFeatures?.error?.code === "unsupported_in_w3kits_webcontainer_v1", "runtime manifest must declare the unsupported local-only feature error code");

assert(daemonServer.includes("handleW3KitsApiRequest"), "daemon server must route API requests through the packaged runtime handler");
assert(daemonServer.includes("W3KITS_RUNTIME_SESSION_REQUEST"), "daemon server must answer runtime session bridge requests");
assert(daemonServer.includes("W3KITS_STORAGE_WRITE"), "daemon server must persist runtime bridge storage writes");
assert(daemonServer.includes("/home/agent/.config/gpt-image-canvas"), "daemon server must persist state under the stable WebContainer data directory");
assert(launcher.includes("startWebContainerAutosave"), "browser-daemon.js must flush WebContainer state through the disk route");
assert(launcher.includes("/webcontainer/disk/files"), "browser-daemon.js must target the WebContainer disk file route");
assert(daemonServer.includes("daemonFetch"), "daemon server must provide a runtime fetch adapter");
assert(daemonServer.includes("staticResponseForUrl"), "daemon server must resolve packaged static assets for runtime API handlers");
assert(runtimeModule.includes("GET /api/provider-config"), "runtime API handler must serve /api/provider-config");
assert(runtimeModule.includes("POST /api/images/generate"), "runtime API handler must serve image generation routes");
assert(runtimeModule.includes("W3KITS_RUNTIME_SESSION_REQUEST"), "runtime API handler must request runtime sessions through the bridge");
assert(runtimePackage.dependencies?.["@gpt-image-canvas/shared"] === "file:./workspace-packages/@gpt-image-canvas/shared", "runtime package must install shared helpers from packaged workspace files");

for (const requiredPath of [
  "index.html",
  "__w3kits/icon.svg",
  "__w3kits/prompt-pool/prompts-all.json",
  "__w3kits/prompt-pool/summary.json",
  "browser-daemon.js",
  "__w3kits/webcontainer-runtime.json",
  "__w3kits/webcontainer-runtime/package.json",
  "__w3kits/webcontainer-runtime/vendor_node_modules/@gpt-image-canvas/shared/package.json",
  "__w3kits/webcontainer-runtime/runtime/daemon/server.js",
  "__w3kits/webcontainer-runtime/apps/web/src/lib/w3kits-runtime.js",
  "__w3kits/webcontainer-runtime/workspace-packages/@gpt-image-canvas/shared/package.json",
]) {
  assert(fs.existsSync(path.join(dist, requiredPath)), `missing packaged runtime asset ${requiredPath}`);
}

console.log("[w3kits] GPT Image Canvas WebContainer package contract verified");
