import readline from 'node:readline';
import type { AgenticMcpContext, JsonRpcFailure, JsonRpcId, JsonRpcInbound, JsonRpcOutbound, JsonRpcRequest } from './contracts.js';
import { invokeAgenticMcpTool, listAgenticMcpTools } from './tool-registry.js';
import { sanitizeText } from '../logging/redactor.js';

/** Stable MCP protocol implemented by the v1.7 stdio server. */
export const TESTIGENT_MCP_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOLS = new Set([TESTIGENT_MCP_PROTOCOL_VERSION, '2025-03-26', '2024-11-05']);

function error(id: JsonRpcId | null, code: number, message: string, data?: unknown): JsonRpcFailure {
  return { jsonrpc: '2.0', id, error: { code, message: sanitizeText(message).slice(0, 500), ...(data === undefined ? {} : { data }) } };
}
function isRequest(message: JsonRpcInbound): message is JsonRpcRequest { return 'id' in message; }

/** Handles one MCP JSON-RPC message using deterministic capability and tool boundaries. */
export async function handleAgenticMcpMessage(message: JsonRpcInbound, context: AgenticMcpContext): Promise<JsonRpcOutbound | undefined> {
  if (message.jsonrpc !== '2.0' || typeof message.method !== 'string') return error(isRequest(message) ? message.id : null, -32600, 'Invalid JSON-RPC request.');
  if (!isRequest(message)) return undefined;
  if (message.method === 'initialize') {
    const requested = typeof message.params?.protocolVersion === 'string' ? message.params.protocolVersion : '';
    if (!SUPPORTED_PROTOCOLS.has(requested)) return error(message.id, -32602, 'Unsupported MCP protocol version.', { supported: [...SUPPORTED_PROTOCOLS] });
    return { jsonrpc: '2.0', id: message.id, result: { protocolVersion: requested, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'testigent-ai-agentic', title: 'TestigentAI Agentic Test Intelligence', version: '1.7.0' }, instructions: 'Read/review-oriented TestigentAI tools. Source mutation and automatic promotion are intentionally not exposed.' } };
  }
  if (message.method === 'ping') return { jsonrpc: '2.0', id: message.id, result: {} };
  if (message.method === 'tools/list') return { jsonrpc: '2.0', id: message.id, result: { tools: listAgenticMcpTools() } };
  if (message.method === 'tools/call') {
    const name = typeof message.params?.name === 'string' ? message.params.name : '';
    if (!name) return error(message.id, -32602, 'tools/call requires params.name.');
    try {
      const output = await invokeAgenticMcpTool(name, message.params?.arguments, context);
      return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output, isError: false } };
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : String(caught);
      return { jsonrpc: '2.0', id: message.id, result: { content: [{ type: 'text', text: sanitizeText(messageText).slice(0, 2_000) }], isError: true } };
    }
  }
  return error(message.id, -32601, `Method not found: ${message.method}`);
}

/** Starts the newline-delimited stdio MCP transport; stdout is reserved exclusively for valid JSON-RPC messages. */
export function startAgenticMcpServer(context: AgenticMcpContext): void {
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  input.on('line', (line: string) => {
    void (async () => {
      let parsed: JsonRpcInbound;
      try { parsed = JSON.parse(line) as JsonRpcInbound; }
      catch { process.stdout.write(`${JSON.stringify(error(null, -32700, 'Parse error.'))}\n`); return; }
      const response = await handleAgenticMcpMessage(parsed, context);
      if (response) process.stdout.write(`${JSON.stringify(response)}\n`);
    })().catch(caught => {
      process.stderr.write(`[testigent-agentic-mcp] ${sanitizeText(caught instanceof Error ? caught.message : String(caught))}\n`);
    });
  });
}
