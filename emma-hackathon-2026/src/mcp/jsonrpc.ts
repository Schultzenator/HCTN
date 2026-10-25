// Pure JSON-RPC 2.0 dispatch for the MCP Streamable HTTP surface
// (stateless JSON mode). No Node APIs here: the HTTP wiring in server.ts
// is a thin shell around dispatch(), which keeps the protocol layer
// testable anywhere.

export interface PropertySchema {
  type: "string" | "number" | "integer" | "boolean" | "array";
  items?: "string";
  description?: string;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  default?: unknown;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, PropertySchema>;
  required?: string[];
}

export interface ToolDef {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: JsonRpcError;
}

export class RpcError extends Error {
  readonly code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export const PROTOCOL_VERSION = "2025-11-25";
export const SERVER_INFO = { name: "emma-fleet-ops-mcp", version: "1.0.0" };

/** Apply a flat JSON-schema subset: types, enums, bounds, defaults. */
export function validateArgs(schema: JsonSchema, args: unknown): Record<string, unknown> {
  const value: Record<string, unknown> = {};
  if (args === undefined || args === null) args = {};
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new RpcError(-32602, "params must be an object");
  }
  const input = args as Record<string, unknown>;
  for (const [key, prop] of Object.entries(schema.properties)) {
    const raw = input[key];
    if (raw === undefined) {
      if (schema.required?.includes(key)) {
        throw new RpcError(-32602, "missing required parameter: " + key);
      }
      if (prop.default !== undefined) value[key] = prop.default;
      continue;
    }
    if (prop.type === "array") {
      if (!Array.isArray(raw) || (prop.items === "string" && raw.some((r) => typeof r !== "string"))) {
        throw new RpcError(-32602, key + " must be an array of strings");
      }
      value[key] = raw;
      continue;
    }
    if (prop.type === "integer" || prop.type === "number") {
      const num = typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw)) ? Number(raw) : raw;
      if (typeof num !== "number" || !Number.isFinite(num)) {
        throw new RpcError(-32602, key + " must be a number");
      }
      if (prop.type === "integer" && !Number.isInteger(num)) {
        throw new RpcError(-32602, key + " must be an integer");
      }
      if (prop.minimum !== undefined && num < prop.minimum) {
        throw new RpcError(-32602, key + " must be >= " + prop.minimum);
      }
      if (prop.maximum !== undefined && num > prop.maximum) {
        throw new RpcError(-32602, key + " must be <= " + prop.maximum);
      }
      value[key] = num;
      continue;
    }
    if (prop.type === "string") {
      if (typeof raw !== "string") throw new RpcError(-32602, key + " must be a string");
      if (prop.enum && !prop.enum.includes(raw)) {
        throw new RpcError(-32602, key + " must be one of: " + prop.enum.join(", "));
      }
      value[key] = raw;
      continue;
    }
    if (typeof raw !== "boolean") throw new RpcError(-32602, key + " must be a boolean");
    value[key] = raw;
  }
  return value;
}

/**
 * Handle one JSON-RPC message. Notifications (no id) return null.
 * Tool execution failures become isError results per the MCP spec;
 * protocol failures become JSON-RPC errors.
 */
export async function dispatch(message: JsonRpcMessage, tools: ToolDef[]): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;
  if (message.id === undefined || message.id === null) {
    if (message.method === "notifications/initialized") return null;
    return null;
  }
  const error = (code: number, text: string): JsonRpcResponse => ({
    jsonrpc: "2.0",
    id,
    error: { code, message: text },
  });
  if (message.method === undefined) return error(-32600, "missing method");
  switch (message.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: SERVER_INFO,
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.inputSchema,
          })),
        },
      };
    case "tools/call": {
      const params = (message.params ?? {}) as { name?: string; arguments?: unknown };
      const tool = tools.find((t) => t.name === params.name);
      if (!tool) return error(-32602, "unknown tool: " + String(params.name));
      try {
        const args = validateArgs(tool.inputSchema, params.arguments);
        const result = await tool.run(args);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
        };
      } catch (err) {
        if (err instanceof RpcError) return error(err.code, err.message);
        const text = err instanceof Error ? err.message : String(err);
        return {
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text }], isError: true },
        };
      }
    }
    default:
      return error(-32601, "method not found: " + message.method);
  }
}
