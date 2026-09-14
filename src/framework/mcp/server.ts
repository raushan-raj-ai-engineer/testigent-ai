import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import type { AgenticMcpContext, JsonRpcFailure, JsonRpcId, JsonRpcOutbound } from './contracts.js';
import { invokeAgenticMcpTool, listAgenticMcpTools } from './tool-registry.js';
import { sanitizeText } from '../logging/redactor.js';

/** MCP protocol revision implemented by the TestigentAI stdio server. */
export const TESTIGENT_MCP_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOLS = new Set([TESTIGENT_MCP_PROTOCOL_VERSION, '2025-03-26', '2024-11-05']);
const DEFAULT_MAX_LINE_BYTES = 1_048_576;
const DEFAULT_MAX_CONCURRENCY = 8;

export interface AgenticMcpSessionState { initialized: boolean; cancelledRequestIds: Set<string>; }
/** Creates isolated MCP lifecycle/cancellation state for one transport session. */
export function createAgenticMcpSession(initialized = false): AgenticMcpSessionState { return { initialized, cancelledRequestIds: new Set<string>() }; }
function rpcError(id: JsonRpcId | null, code: number, message: string, data?: unknown): JsonRpcFailure { return { jsonrpc: '2.0', id, error: { code, message: sanitizeText(message).slice(0, 500), ...(data === undefined ? {} : { data }) } }; }

/** Handles one unknown JSON-RPC payload. Direct callers default to an initialized session for backwards-compatible unit invocation. */
export async function handleAgenticMcpMessage(message: unknown, context: AgenticMcpContext, session: AgenticMcpSessionState = createAgenticMcpSession(true)): Promise<JsonRpcOutbound | undefined> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return rpcError(null, -32600, 'Invalid JSON-RPC request.');
  const value = message as Record<string, unknown>;
  const hasId = Object.prototype.hasOwnProperty.call(value, 'id');
  const id = hasId && (typeof value.id === 'string' || typeof value.id === 'number') ? value.id : null;
  if (hasId && id === null) return rpcError(null, -32600, 'JSON-RPC id must be a string or number.');
  if (value.jsonrpc !== '2.0' || typeof value.method !== 'string') return rpcError(id, -32600, 'Invalid JSON-RPC request.');
  const params = value.params === undefined ? {} : isRecord(value.params) ? value.params : undefined;
  if (params === undefined) return hasId ? rpcError(id, -32602, 'params must be an object.') : undefined;

  if (!hasId) {
    if (value.method === 'notifications/initialized') { session.initialized = true; return undefined; }
    if (value.method === 'notifications/cancelled') { const requestId = params.requestId; if (typeof requestId === 'string' || typeof requestId === 'number') session.cancelledRequestIds.add(String(requestId)); return undefined; }
    return undefined;
  }

  const responseId: JsonRpcId = id as JsonRpcId;
  if (value.method === 'initialize') {
    const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
    if (!SUPPORTED_PROTOCOLS.has(requested)) return rpcError(responseId, -32602, 'Unsupported MCP protocol version.', { supported: [...SUPPORTED_PROTOCOLS] });
    session.initialized = true;
    return { jsonrpc: '2.0', id: responseId, result: { protocolVersion: requested, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'testigent-ai-agentic', title: 'TestigentAI Agentic Test Intelligence', version: productVersion(context.root) }, instructions: 'Read/review-oriented TestigentAI tools. Caller-supplied failure evidence remains UNVERIFIED and non-claimable.' } };
  }
  if (value.method === 'ping') return { jsonrpc: '2.0', id: responseId, result: {} };
  if (!session.initialized) return rpcError(responseId, -32002, 'MCP session is not initialized.');
  if (session.cancelledRequestIds.delete(String(responseId))) return rpcError(responseId, -32800, 'Request cancelled.');
  if (value.method === 'tools/list') return { jsonrpc: '2.0', id: responseId, result: { tools: listAgenticMcpTools() } };
  if (value.method === 'tools/call') {
    const name = typeof params.name === 'string' ? params.name : '';
    if (!name) return rpcError(responseId, -32602, 'tools/call requires params.name.');
    try {
      const output = await invokeAgenticMcpTool(name, params.arguments, context);
      return { jsonrpc: '2.0', id: responseId, result: { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output, isError: false } };
    } catch (caught) {
      const messageText = caught instanceof Error ? caught.message : String(caught);
      return { jsonrpc: '2.0', id: responseId, result: { content: [{ type: 'text', text: sanitizeText(messageText).slice(0, 2_000) }], isError: true } };
    }
  }
  return rpcError(responseId, -32601, `Method not found: ${value.method}`);
}

/** Newline-delimited stdio transport with explicit message-size and concurrency budgets. */
export function startAgenticMcpServer(context: AgenticMcpContext): void {
  const session = createAgenticMcpSession(false);
  const maxBytes = positiveInteger(process.env.MCP_MAX_LINE_BYTES, DEFAULT_MAX_LINE_BYTES);
  const maxConcurrency = positiveInteger(process.env.MCP_MAX_CONCURRENCY, DEFAULT_MAX_CONCURRENCY);
  let active = 0;
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  input.on('line', (line: string) => {
    if (Buffer.byteLength(line, 'utf8') > maxBytes) { write(rpcError(null, -32001, `MCP request exceeds ${maxBytes} bytes.`)); return; }
    let parsed: unknown;
    try { parsed = JSON.parse(line) as unknown; } catch { write(rpcError(null, -32700, 'Parse error.')); return; }
    if (active >= maxConcurrency) { write(rpcError(requestId(parsed), -32000, 'MCP concurrency limit exceeded.')); return; }
    active += 1;
    void handleAgenticMcpMessage(parsed, context, session)
      .then(response => { if (response) write(response); })
      .catch(caught => write(rpcError(requestId(parsed), -32603, caught instanceof Error ? caught.message : String(caught))))
      .finally(() => { active -= 1; });
  });
}

/** Enforces the configured MCP request byte budget before parsing or dispatch. */
export function validateMcpLineSize(line: string, maxBytes = DEFAULT_MAX_LINE_BYTES): void { if (Buffer.byteLength(line, 'utf8') > maxBytes) throw new Error(`MCP request exceeds ${maxBytes} bytes.`); }
function write(response: JsonRpcOutbound): void { process.stdout.write(`${JSON.stringify(response)}\n`); }
function requestId(value: unknown): JsonRpcId | null { if (!isRecord(value)) return null; return typeof value.id === 'string' || typeof value.id === 'number' ? value.id : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function positiveInteger(raw: string | undefined, fallback: number): number { const value = Number(raw ?? fallback); return Number.isInteger(value) && value > 0 ? value : fallback; }
function productVersion(root: string): string { try { const parsed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: unknown }; return typeof parsed.version === 'string' ? parsed.version : 'unknown'; } catch { return process.env.npm_package_version ?? 'unknown'; } }
