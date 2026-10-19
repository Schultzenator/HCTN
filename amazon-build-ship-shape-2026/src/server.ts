import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerTools } from "./tools.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

function createServer(): McpServer {
  const server = new McpServer(
    { name: "household-ops-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );
  registerTools(server);
  return server;
}

const LANDING = [
  "<!doctype html><html><head><meta charset=\"utf-8\"><title>Household Ops MCP</title>",
  "<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;line-height:1.6}code{background:#f2f2f2;padding:2px 6px;border-radius:4px}</style>",
  "</head><body><h1>Household Ops MCP</h1>",
  "<p>Self-hosted MCP server (Streamable HTTP, stateless JSON mode) for an Alexa+ household integration.</p>",
  "<p>MCP endpoint: <code>POST /mcp</code> &middot; health: <code>GET /healthz</code></p>",
  "<p>Try a simulated Alexa+ turn: <code>bash demo/demo-alexa-turn.sh</code></p>",
  "<p>Tools: household_summary, add_grocery_item, get_shopping_list, assign_chores, plan_movie_night.</p>",
  "</body></html>",
].join("");

const httpServer = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://" + (req.headers.host ?? "localhost"));
  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(LANDING);
    return;
  }
  if (req.method === "GET" && url.pathname === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  if (url.pathname !== "/mcp") {
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "not found", hint: "POST /mcp for MCP Streamable HTTP" }));
    return;
  }
  if (req.method === "GET" || req.method === "DELETE") {
    // Stateless mode: no SSE stream to open, no server-side session to terminate.
    res.writeHead(405, { allow: "POST", "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed in stateless mode" }, id: null }));
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { allow: "POST" });
    res.end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", async () => {
    let parsed: unknown;
    try {
      if (body.length > 0) parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32700, message: "Parse error" }, id: null }));
      return;
    }
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
      const server = createServer();
      res.on("close", () => {
        transport.close();
        server.close();
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, parsed);
    } catch {
      if (!res.headersSent) res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null }));
    }
  });
});

httpServer.listen(PORT, () => {
  console.log("household-ops-mcp listening on :" + PORT + " (POST /mcp, Streamable HTTP, stateless JSON mode)");
});
