import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const webDist = path.join(root, "apps", "web", "dist");
const dist = path.join(root, "dist");
const webcontainerBuild = path.join(root, ".generated", "webcontainer-runtime");
const indexHtml = path.join(webDist, "index.html");
const iconSource = path.join(root, "apps", "web", "public", "brand-logo.png");
const w3kitsDir = path.join(dist, "__w3kits");
const iconTarget = path.join(w3kitsDir, "icon.png");
const runtimeRoot = path.join(w3kitsDir, "webcontainer-runtime");
const promptPoolSourceDir = path.join(root, "prompt-pool-data");
const promptPoolTargetDir = path.join(w3kitsDir, "prompt-pool");
const browserDaemonSource = path.join(root, "runtime", "browser-daemon.js");
const browserDaemonTarget = path.join(dist, "browser-daemon.js");
const runtimeManifestTarget = path.join(w3kitsDir, "webcontainer-runtime.json");
const sharedDistSource = path.join(root, "packages", "shared", "dist");
const sharedPackageSource = path.join(root, "packages", "shared", "package.json");
const sharedRuntimeRoot = path.join(runtimeRoot, "workspace-packages", "@gpt-image-canvas", "shared");

if (!fs.existsSync(indexHtml)) {
  throw new Error("Missing web build output: apps/web/dist/index.html");
}

if (!fs.existsSync(iconSource)) {
  throw new Error("Missing upstream GPT Image Canvas icon source: apps/web/public/brand-logo.png");
}

if (!fs.existsSync(browserDaemonSource)) {
  throw new Error("Missing WebContainer launcher source: runtime/browser-daemon.js");
}

if (!fs.existsSync(webcontainerBuild)) {
  throw new Error("Missing WebContainer runtime build output: .generated/webcontainer-runtime");
}

if (!fs.existsSync(sharedDistSource)) {
  throw new Error("Missing shared package build output: packages/shared/dist");
}

fs.rmSync(dist, { force: true, recursive: true });
fs.cpSync(webDist, dist, { recursive: true });
fs.mkdirSync(w3kitsDir, { recursive: true });
fs.copyFileSync(iconSource, iconTarget);
fs.copyFileSync(browserDaemonSource, browserDaemonTarget);
fs.cpSync(webcontainerBuild, runtimeRoot, { recursive: true });
fs.mkdirSync(sharedRuntimeRoot, { recursive: true });
fs.cpSync(sharedDistSource, path.join(sharedRuntimeRoot, "dist"), { recursive: true });
fs.copyFileSync(sharedPackageSource, path.join(sharedRuntimeRoot, "package.json"));
fs.writeFileSync(
  path.join(runtimeRoot, "package.json"),
  `${JSON.stringify(
    {
      name: "@w3kits/gpt-image-canvas-webcontainer-runtime",
      private: true,
      type: "module",
      dependencies: {
        "@gpt-image-canvas/shared": "file:./workspace-packages/@gpt-image-canvas/shared",
      },
    },
    null,
    2,
  )}\n`,
);
execFileSync("npm", ["install", "--ignore-scripts", "--omit=dev", "--package-lock=false", "--no-fund", "--no-audit"], {
  cwd: runtimeRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    npm_config_audit: "false",
    npm_config_fund: "false",
  },
});
if (fs.existsSync(path.join(runtimeRoot, "vendor_node_modules"))) {
  fs.rmSync(path.join(runtimeRoot, "vendor_node_modules"), { recursive: true, force: true });
}
fs.renameSync(path.join(runtimeRoot, "node_modules"), path.join(runtimeRoot, "vendor_node_modules"));
fs.writeFileSync(
  runtimeManifestTarget,
  `${JSON.stringify(
    {
      schemaVersion: 1,
      pluginId: "gpt-image-canvas",
      mode: "daemon-webcontainer",
      runtimeRoot: "__w3kits/webcontainer-runtime",
      requiresCrossOriginIsolation: true,
      daemon: {
        entry: "__w3kits/webcontainer-runtime/runtime/daemon/server.js",
        startCommand: ["node", "__w3kits/webcontainer-runtime/runtime/daemon/server.js", "--host", "0.0.0.0", "--port", "7462"],
        port: 7462,
        healthPath: "/api/health",
      },
      ai: {
        openaiBaseUrl: "https://w3kits.com/api/ai/openai/v1",
        defaultImageModel: "gpt-image-2",
      },
      persistence: {
        authority: "w3kits-plugin-user-data",
        dataDir: "/home/agent/.config/gpt-image-canvas",
        diskRoot: "/home/agent/.config/gpt-image-canvas",
        flushPolicy: {
          intervalMs: 30000,
          lifecycleEvents: ["visibilitychange", "pagehide", "daemon-ready", "run-complete", "daemon-stop", "daemon-crash"],
        },
        include: ["state/**", "assets/**", "gallery/**"],
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
