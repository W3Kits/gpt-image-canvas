import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const webDist = path.join(root, "apps", "web", "dist");
const dist = path.join(root, "dist");
const indexHtml = path.join(webDist, "index.html");
const iconSource = path.join(root, "assets", "w3kits-icon.svg");
const w3kitsDir = path.join(dist, "__w3kits");
const iconTarget = path.join(w3kitsDir, "icon.svg");
const promptPoolSourceDir = path.join(root, "prompt-pool-data");
const promptPoolTargetDir = path.join(w3kitsDir, "prompt-pool");
const browserDaemonSource = path.join(root, "runtime", "browser-daemon.js");
const daemonCliSource = path.join(root, "runtime", "daemon", "cli.js");
const browserDaemonTarget = path.join(dist, "browser-daemon.js");
const daemonCliTarget = path.join(w3kitsDir, "webcontainer-runtime", "apps", "daemon", "dist", "cli.js");
const runtimeManifestTarget = path.join(w3kitsDir, "webcontainer-runtime.json");

if (!fs.existsSync(indexHtml)) {
  throw new Error("Missing web build output: apps/web/dist/index.html");
}

if (!fs.existsSync(iconSource)) {
  throw new Error("Missing W3Kits icon source: assets/w3kits-icon.svg");
}

if (!fs.existsSync(browserDaemonSource)) {
  throw new Error("Missing WebContainer launcher source: runtime/browser-daemon.js");
}

if (!fs.existsSync(daemonCliSource)) {
  throw new Error("Missing WebContainer daemon source: runtime/daemon/cli.js");
}

fs.rmSync(dist, { force: true, recursive: true });
fs.cpSync(webDist, dist, { recursive: true });
fs.mkdirSync(w3kitsDir, { recursive: true });
fs.copyFileSync(iconSource, iconTarget);
fs.mkdirSync(path.dirname(daemonCliTarget), { recursive: true });
fs.copyFileSync(browserDaemonSource, browserDaemonTarget);
fs.copyFileSync(daemonCliSource, daemonCliTarget);
fs.writeFileSync(
  runtimeManifestTarget,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      pluginId: "gpt-image-canvas",
      mode: "browser-webcontainer",
      requiresCrossOriginIsolation: true,
      daemon: {
        entry: "__w3kits/webcontainer-runtime/apps/daemon/dist/cli.js",
        startCommand: ["node", "__w3kits/webcontainer-runtime/apps/daemon/dist/cli.js", "--host", "0.0.0.0", "--port", "7462"],
        port: 7462,
        healthPath: "/api/health",
      },
      ai: {
        openaiBaseUrl: "https://w3kits.com/api/ai/openai/v1",
        defaultImageModel: "gpt-image-2",
      },
      persistence: {
        authority: "w3kits-plugin-user-data",
      },
      unsupportedLocalOnlyFeatures: {
        error: {
          code: "unsupported_in_w3kits_webcontainer_v1",
          message: "Standalone local server features stay out of the W3Kits WebContainer scope cut.",
        },
      },
    },
    null,
    2,
  )}\n`,
);

if (fs.existsSync(path.join(promptPoolSourceDir, "prompts-all.json"))) {
  fs.mkdirSync(promptPoolTargetDir, { recursive: true });
  fs.copyFileSync(path.join(promptPoolSourceDir, "prompts-all.json"), path.join(promptPoolTargetDir, "prompts-all.json"));
}

if (fs.existsSync(path.join(promptPoolSourceDir, "summary.json"))) {
  fs.mkdirSync(promptPoolTargetDir, { recursive: true });
  fs.copyFileSync(path.join(promptPoolSourceDir, "summary.json"), path.join(promptPoolTargetDir, "summary.json"));
}
