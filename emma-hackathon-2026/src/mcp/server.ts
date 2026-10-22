/**
 * Zero-dependency MCP server (stdio transport).
 *
 * Implements the subset of the Model Context Protocol needed to expose the
 * FleetPilot agent tools to any MCP-capable LLM client (Claude Desktop, IDE
 * agents, other CLIs): initialize, ping, tools/list, tools/call over
 * newline-delimited JSON-RPC 2.0 on stdin/stdout.
 *
 * The protocol handling is kept as a pure function (handleMcpMessage) so tests
 * can exercise it without spawning a process; runStdioServer only moves bytes.
 */

import * as readline from 'node:readline';

import type { EmmaClient } from '../types.js';
import { createTools, type AgentTool, type ToolContext } from '../agent/tools.js';

export const PROTOCOL_VERSION = '2025-06-18';
export const SERVER_NAME = 'fleetpilot';
export const SERVER_VERSION = '0.1.0';

export interface McpState {
  context: ToolContext;
  tools: AgentTool[];
}

export function createMcpState(client: EmmaClient): McpState {
  return { context: { client }, tools: createTools() };
}

interface JsonRpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

function isRequest(message: JsonRpcMessage): boolean {
  return message.id !== undefined && message.id !== null;
}

function response(id: unknown, result: unknown): unknown {
  return { jsonrpc: '2.0', id, result };
}

function errorResponse(id: unknown, code: number, message: string): unknown {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Handles one decoded JSON-RPC message. Returns the response object, or null
 * for notifications (which must not be answered per JSON-RPC 2.0).
 */
export async function handleMcpMessage(
  state: McpState,
  message: unknown,
): Promise<unknown> {
  if (typeof message !== 'object' || message === null) {
    return errorResponse(null, -32600, 'Invalid Request');
  }
  const rpc = message as JsonRpcMessage;
  if (rpc.jsonrpc !== '2.0' || typeof rpc.method !== 'string') {
    return isRequest(rpc)
      ? errorResponse(rpc.id, -32600, 'Invalid Request')
      : null;
  }

  const hasId = isRequest(rpc);
  const method = rpc.method;
  const params =
    typeof rpc.params === 'object' && rpc.params !== null
      ? (rpc.params as Record<string, unknown>)
      : {};

  if (method === 'initialize') {
    return response(rpc.id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    });
  }

  if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
    return null;
  }

  if (method === 'ping') {
    return hasId ? response(rpc.id, {}) : null;
  }

  if (method === 'tools/list') {
    return response(rpc.id, {
      tools: state.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    });
  }

  if (method === 'tools/call') {
    if (!hasId) {
      return null;
    }
    const name = params.name;
    const args = params.arguments;
    const tool = state.tools.find((candidate) => candidate.name === name);
    if (!tool) {
      return errorResponse(rpc.id, -32602, `Unknown tool: ${String(name)}`);
    }
    try {
      const result = await tool.run(args, state.context);
      return response(rpc.id, {
        content: result.content,
        ...(result.isError ? { isError: true } : {}),
      });
    } catch (caught) {
      return response(rpc.id, {
        content: [{ type: 'text', text: `Tool error: ${String(caught)}` }],
        isError: true,
      });
    }
  }

  return hasId
    ? errorResponse(rpc.id, -32601, `Method not found: ${method}`)
    : null;
}

/** Line-delimited JSON-RPC transport over any readable/writable streams. */
export async function runStdioServer(
  state: McpState,
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
): Promise<void> {
  const reader = readline.createInterface({ input });
  const write = (payload: unknown) => {
    output.write(JSON.stringify(payload) + '\n');
  };

  reader.on('line', (line: string) => {
    const trimmed = line.trim();
    if (trimmed === '') {
      return;
    }
    let message: unknown;
    try {
      message = JSON.parse(trimmed);
    } catch {
      write(errorResponse(null, -32700, 'Parse error'));
      return;
    }
    void handleMcpMessage(state, message).then((reply) => {
      if (reply !== null) {
        write(reply);
      }
    });
  });

  await new Promise<void>((resolve) => {
    reader.on('close', () => resolve());
  });
}
