import { pathToFileURL } from "node:url";

function isMainModule(): boolean {
  const entryUrl = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
  return entryUrl === import.meta.url;
}

const isW3KitsWebContainer = process.env.W3KITS_WEBCONTAINER === "1";

if (isMainModule()) {
  if (isW3KitsWebContainer) {
    await import("../../../runtime/daemon/server.js");
  } else {
    const [{ serve }, agentRuntime, databaseRuntime, runtimeConfig, serverRuntime] = await Promise.all([
      import("@hono/node-server"),
      import("./domain/agent/websocket-session.js"),
      import("./infrastructure/database.js"),
      import("./infrastructure/runtime.js"),
      import("./server/app.js")
    ]);

    const server = serve(
      {
        fetch: serverRuntime.app.fetch,
        websocket: { server: serverRuntime.agentWebSocketServer },
        hostname: runtimeConfig.serverConfig.host,
        port: runtimeConfig.serverConfig.port
      },
      (info) => {
        console.log(`API listening at http://${info.address}:${info.port}`);
      }
    );

    const shutdown = (): void => {
      agentRuntime.closeAllAgentSessions("server_shutdown");
      serverRuntime.agentWebSocketServer.close();
      databaseRuntime.closeDatabase();
      server.close();
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }
}

export const app = undefined;
export const agentWebSocketServer = undefined;
