import { createServer } from "node:http";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const staticRoot = path.resolve(__dirname, "../../../../../");

const contentTypes = {
  ".css": "text/css;charset=UTF-8",
  ".html": "text/html;charset=UTF-8",
  ".js": "text/javascript;charset=UTF-8",
  ".json": "application/json;charset=UTF-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function parseArgs(argv) {
  const options = { host: "0.0.0.0", port: 7462 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--host" && argv[index + 1]) options.host = argv[++index];
    else if (value === "--port" && argv[index + 1]) options.port = Number(argv[++index]) || 7462;
  }
  return options;
}

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json;charset=UTF-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
}

function safePathname(value) {
  const pathname = decodeURIComponent(value.split("?")[0] || "/");
  const normalized = pathname === "/" ? "/index.html" : pathname;
  const resolved = path.resolve(staticRoot, `.${normalized}`);
  if (!resolved.startsWith(staticRoot)) return null;
  return resolved;
}

async function serveStatic(request, response) {
  const filePath = safePathname(request.url || "/");
  if (!filePath) {
    json(response, 400, { error: { code: "invalid_path", message: "Invalid path." } });
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const target = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const body = await fs.readFile(target);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(target)] || "application/octet-stream",
      "cache-control": target.endsWith(".html") ? "no-store" : "public, max-age=31536000, immutable",
    });
    response.end(body);
  } catch {
    json(response, 404, { error: { code: "not_found", message: "Not found." } });
  }
}

async function route(request, response) {
  const url = new URL(request.url || "/", "http://localhost");
  if (request.method === "GET" && url.pathname === "/api/health") {
    json(response, 200, {
      ok: true,
      plugin: "gpt-image-canvas",
      mode: "w3kits-webcontainer-static-daemon",
    });
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    json(response, 404, {
      error: {
        code: "w3kits_api_fallback_expected",
        message: "The browser runtime owns this API surface inside W3Kits.",
      },
    });
    return;
  }

  await serveStatic(request, response);
}

const { host, port } = parseArgs(process.argv.slice(2));
const server = createServer((request, response) => {
  void route(request, response).catch((error) => {
    json(response, 500, {
      error: {
        code: "daemon_failed",
        message: error instanceof Error ? error.message : String(error),
      },
    });
  });
});

server.listen(port, host, () => {
  console.log(`[gpt-image-canvas] listening on http://${host}:${port}`);
});
