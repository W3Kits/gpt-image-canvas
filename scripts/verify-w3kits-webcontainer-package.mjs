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
const daemonCli = readText("__w3kits/webcontainer-runtime/apps/daemon/dist/cli.js");
const runtime = readJson("__w3kits/webcontainer-runtime.json");

assert(launcher.includes("bootW3KitsWebContainerPlugin"), "browser-daemon.js must export the WebContainer boot adapter");
assert(launcher.includes("w3kits_gpt_image_canvas_daemon_start_timeout"), "browser-daemon.js must declare the GPT Image Canvas start timeout");
assert(launcher.includes("W3KITS_OPENAI_BASE_URL"), "browser-daemon.js must pass the W3Kits OpenAI base URL");
assert(launcher.includes("w3kitsParentOrigin"), "browser-daemon.js must propagate the parent origin");
assert(launcher.includes("w3kitsLocale"), "browser-daemon.js must propagate locale");

assert(runtime.schemaVersion === 1, "runtime manifest schemaVersion must be 1");
assert(runtime.pluginId === "gpt-image-canvas", "runtime manifest pluginId must be gpt-image-canvas");
assert(runtime.mode === "browser-webcontainer", "runtime manifest mode must be browser-webcontainer");
assert(runtime.requiresCrossOriginIsolation === true, "runtime manifest must require cross-origin isolation");
assert(runtime.daemon?.entry === "__w3kits/webcontainer-runtime/apps/daemon/dist/cli.js", "runtime manifest must point at the packaged daemon cli");
assert(Array.isArray(runtime.daemon?.startCommand), "runtime manifest must include daemon startCommand");
assert(runtime.daemon.startCommand.join(" ").includes("__w3kits/webcontainer-runtime/apps/daemon/dist/cli.js"), "daemon startCommand must launch the packaged daemon cli");
assert(runtime.daemon.port === 7462, "runtime manifest must pin port 7462");
assert(runtime.daemon.healthPath === "/api/health", "runtime manifest must pin /api/health");
assert(runtime.ai?.openaiBaseUrl === "https://w3kits.com/api/ai/openai/v1", "runtime manifest must use the W3Kits OpenAI base URL");
assert(runtime.ai?.defaultImageModel === "gpt-image-2", "runtime manifest must declare gpt-image-2 as the default image model");
assert(runtime.persistence?.authority === "w3kits-plugin-user-data", "runtime manifest must declare W3Kits plugin user data persistence");
assert(runtime.unsupportedLocalOnlyFeatures?.error?.code === "unsupported_in_w3kits_webcontainer_v1", "runtime manifest must declare the unsupported local-only feature error code");

assert(daemonCli.includes("/api/health"), "daemon cli must expose /api/health");
assert(daemonCli.includes("w3kits_api_fallback_expected"), "daemon cli must leave API ownership to the browser fallback");
assert(daemonCli.includes("w3kits-webcontainer-static-daemon"), "daemon cli must declare the WebContainer static-daemon mode");

for (const requiredPath of [
  "index.html",
  "__w3kits/icon.svg",
  "__w3kits/prompt-pool/prompts-all.json",
  "__w3kits/prompt-pool/summary.json",
  "browser-daemon.js",
  "__w3kits/webcontainer-runtime.json",
  "__w3kits/webcontainer-runtime/apps/daemon/dist/cli.js",
]) {
  assert(fs.existsSync(path.join(dist, requiredPath)), `missing packaged runtime asset ${requiredPath}`);
}

console.log("[w3kits] GPT Image Canvas WebContainer package contract verified");
