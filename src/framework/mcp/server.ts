import fs from 'node:fs';
import path from 'node:path';
import type { AgenticMcpContext, JsonRpcFailure, JsonRpcId, JsonRpcOutbound, McpToolDefinition } from './contracts.js';
import { invokeAgenticMcpTool, listAgenticMcpTools } from './tool-registry.js';
import { sanitizeText } from '../logging/redactor.js';

/** MCP protocol revision implemented by the TestigentAI stdio server. */
export const TESTIGENT_MCP_PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_PROTOCOLS = new Set([TESTIGENT_MCP_PROTOCOL_VERSION, '2025-03-26', '2024-11-05']);
const DEFAULT_MAX_LINE_BYTES = 1_048_576;
const DEFAULT_MAX_CONCURRENCY = 8;

export type AgenticMcpLifecyclePhase = 'NEW' | 'INITIALIZE_RESPONDED' | 'READY';
export interface AgenticMcpSessionState {
  phase: AgenticMcpLifecyclePhase;
  /** Compatibility projection: true only after the required initialized notification. */
  initialized: boolean;
  activeRequests: Map<string, AbortController>;
  negotiatedProtocol?: string;
}
export interface AgenticMcpDependencies {
  listTools?: () => McpToolDefinition[];
  invokeTool?: (name: string, rawArguments: unknown, context: AgenticMcpContext) => Promise<unknown>;
}
export interface AgenticMcpTransportOptions extends AgenticMcpDependencies { maxBytes?: number; maxConcurrency?: number; }

/** Creates isolated MCP lifecycle/cancellation state for one transport session. */
export function createAgenticMcpSession(initialized = false): AgenticMcpSessionState {
  return { phase: initialized ? 'READY' : 'NEW', initialized, activeRequests: new Map<string, AbortController>() };
}
function setPhase(session: AgenticMcpSessionState, phase: AgenticMcpLifecyclePhase): void { session.phase = phase; session.initialized = phase === 'READY'; }
function rpcError(id: JsonRpcId | null, code: number, message: string, data?: unknown): JsonRpcFailure { return { jsonrpc: '2.0', id, error: { code, message: sanitizeText(message).slice(0, 500), ...(data === undefined ? {} : { data }) } }; }

/** Handles one JSON-RPC payload and enforces MCP lifecycle, cancellation and bounded request semantics. */
export async function handleAgenticMcpMessage(
  message: unknown,
  context: AgenticMcpContext,
  session: AgenticMcpSessionState = createAgenticMcpSession(true),
  dependencies: AgenticMcpDependencies = {},
): Promise<JsonRpcOutbound | undefined> {
  if (!message || typeof message !== 'object' || Array.isArray(message)) return rpcError(null, -32600, 'Invalid JSON-RPC request.');
  const value = message as Record<string, unknown>;
  const hasId = Object.prototype.hasOwnProperty.call(value, 'id');
  const id = hasId && (typeof value.id === 'string' || typeof value.id === 'number') ? value.id : null;
  if (hasId && id === null) return rpcError(null, -32600, 'JSON-RPC id must be a string or number.');
  if (value.jsonrpc !== '2.0' || typeof value.method !== 'string') return rpcError(id, -32600, 'Invalid JSON-RPC request.');
  const params = value.params === undefined ? {} : isRecord(value.params) ? value.params : undefined;
  if (params === undefined) return hasId ? rpcError(id, -32602, 'params must be an object.') : undefined;

  if (!hasId) {
    if (value.method === 'notifications/initialized') {
      // Per MCP lifecycle this notification only completes a successful initialize exchange.
      if (session.phase === 'INITIALIZE_RESPONDED') setPhase(session, 'READY');
      return undefined;
    }
    if (value.method === 'notifications/cancelled') {
      const requestIdValue = params.requestId;
      if (typeof requestIdValue === 'string' || typeof requestIdValue === 'number') session.activeRequests.get(String(requestIdValue))?.abort();
      return undefined;
    }
    return undefined;
  }

  const responseId: JsonRpcId = id as JsonRpcId;
  if (value.method === 'initialize') {
    if (session.phase !== 'NEW') return rpcError(responseId, -32600, 'MCP initialize may only occur once at the start of a session.');
    const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '';
    if (!SUPPORTED_PROTOCOLS.has(requested)) return rpcError(responseId, -32602, 'Unsupported MCP protocol version.', { supported: [...SUPPORTED_PROTOCOLS] });
    if (!isRecord(params.capabilities) || !isImplementation(params.clientInfo)) return rpcError(responseId, -32602, 'initialize requires client capabilities and clientInfo {name, version}.');
    session.negotiatedProtocol = requested;
    setPhase(session, 'INITIALIZE_RESPONDED');
    return { jsonrpc: '2.0', id: responseId, result: { protocolVersion: requested, capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'testigent-ai-agentic', title: 'TestigentAI Agentic Test Intelligence', version: productVersion(context.root) }, instructions: 'Read/review-oriented TestigentAI tools. Caller-supplied failure evidence remains UNVERIFIED and non-claimable.' } };
  }
  if (value.method === 'ping') return { jsonrpc: '2.0', id: responseId, result: {} };
  if (session.phase !== 'READY') return rpcError(responseId, -32002, 'MCP session is not ready; complete initialize then send notifications/initialized.');
  if (value.method === 'tools/list') return { jsonrpc: '2.0', id: responseId, result: { tools: (dependencies.listTools ?? listAgenticMcpTools)() } };
  if (value.method === 'tools/call') {
    const name = typeof params.name === 'string' ? params.name : '';
    if (!name) return rpcError(responseId, -32602, 'tools/call requires params.name.');
    const key = String(responseId);
    if (session.activeRequests.has(key)) return rpcError(responseId, -32600, `Duplicate active request id '${key}'.`);
    const controller = new AbortController();
    if (context.abortSignal?.aborted) controller.abort();
    const onParentAbort = () => controller.abort();
    context.abortSignal?.addEventListener('abort', onParentAbort, { once: true });
    session.activeRequests.set(key, controller);
    try {
      const invoke = dependencies.invokeTool ?? invokeAgenticMcpTool;
      const work = invoke(name, params.arguments, { ...context, abortSignal: controller.signal });
      const output = await raceCancellation(work, controller.signal);
      return { jsonrpc: '2.0', id: responseId, result: { content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output, isError: false } };
    } catch (caught) {
      if (isAbort(caught) || controller.signal.aborted) return rpcError(responseId, -32800, 'Request cancelled.');
      const messageText = caught instanceof Error ? caught.message : String(caught);
      return { jsonrpc: '2.0', id: responseId, result: { content: [{ type: 'text', text: sanitizeText(messageText).slice(0, 2_000) }], isError: true } };
    } finally {
      context.abortSignal?.removeEventListener('abort', onParentAbort);
      session.activeRequests.delete(key);
    }
  }
  return rpcError(responseId, -32601, `Method not found: ${value.method}`);
}

/** Starts the production stdio transport. Byte limits are enforced while frames are assembled, before newline arrival. */
export function startAgenticMcpServer(context: AgenticMcpContext): void { startAgenticMcpTransport(process.stdin, process.stdout, context); }

/** Stream-injectable transport used by production stdio and real child-process transport regression tests. */
export function startAgenticMcpTransport(input: NodeJS.ReadableStream, output: NodeJS.WritableStream, context: AgenticMcpContext, options: AgenticMcpTransportOptions = {}): void {
  const session = createAgenticMcpSession(false);
  const maxBytes = options.maxBytes ?? positiveInteger(process.env.MCP_MAX_LINE_BYTES, DEFAULT_MAX_LINE_BYTES);
  const maxConcurrency = options.maxConcurrency ?? positiveInteger(process.env.MCP_MAX_CONCURRENCY, DEFAULT_MAX_CONCURRENCY);
  if (!Number.isInteger(maxBytes) || maxBytes <= 0 || !Number.isInteger(maxConcurrency) || maxConcurrency <= 0) throw new Error('MCP transport budgets must be positive integers.');
  let active = 0;
  let pending = Buffer.alloc(0);
  let discardingOversizedFrame = false;

  const emit = (response: JsonRpcOutbound): void => { output.write(`${JSON.stringify(response)}\n`); };
  const dispatchLine = (lineBuffer: Buffer): void => {
    const line = stripTrailingCr(lineBuffer).toString('utf8');
    if (!line.trim()) return;
    let parsed: unknown;
    try { parsed = JSON.parse(line) as unknown; } catch { emit(rpcError(null, -32700, 'Parse error.')); return; }
    const control = isControlNotification(parsed) || isPing(parsed);
    if (!control && active >= maxConcurrency) { emit(rpcError(requestId(parsed), -32000, 'MCP concurrency limit exceeded.')); return; }
    if (!control) active += 1;
    void handleAgenticMcpMessage(parsed, context, session, options)
      .then(response => { if (response) emit(response); })
      .catch(caught => emit(rpcError(requestId(parsed), -32603, caught instanceof Error ? caught.message : String(caught))))
      .finally(() => { if (!control) active -= 1; });
  };

  input.on('data', (chunk: string | Buffer) => {
    const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, 'utf8');
    let offset = 0;
    while (offset < data.length) {
      const newline = data.indexOf(0x0a, offset);
      const end = newline === -1 ? data.length : newline;
      const segment = data.subarray(offset, end);
      if (discardingOversizedFrame) {
        if (newline === -1) return;
        discardingOversizedFrame = false; offset = newline + 1; continue;
      }
      if (pending.length + segment.length > maxBytes) {
        pending = Buffer.alloc(0);
        emit(rpcError(null, -32001, `MCP request exceeds ${maxBytes} bytes.`));
        if (newline === -1) { discardingOversizedFrame = true; return; }
        offset = newline + 1; continue;
      }
      if (segment.length) pending = pending.length ? Buffer.concat([pending, segment]) : Buffer.from(segment);
      if (newline === -1) return;
      const complete = pending; pending = Buffer.alloc(0); offset = newline + 1; dispatchLine(complete);
    }
  });
}

/** Enforces the configured MCP request byte budget before parsing or dispatch. */
export function validateMcpLineSize(line: string, maxBytes = DEFAULT_MAX_LINE_BYTES): void { if (Buffer.byteLength(line, 'utf8') > maxBytes) throw new Error(`MCP request exceeds ${maxBytes} bytes.`); }
function requestId(value: unknown): JsonRpcId | null { if (!isRecord(value)) return null; return typeof value.id === 'string' || typeof value.id === 'number' ? value.id : null; }
function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function isImplementation(value: unknown): boolean { return isRecord(value) && typeof value.name === 'string' && Boolean(value.name.trim()) && typeof value.version === 'string' && Boolean(value.version.trim()); }
function isControlNotification(value: unknown): boolean { return isRecord(value) && !Object.prototype.hasOwnProperty.call(value, 'id') && (value.method === 'notifications/cancelled' || value.method === 'notifications/initialized'); }
function isPing(value: unknown): boolean { return isRecord(value) && Object.prototype.hasOwnProperty.call(value, 'id') && value.method === 'ping'; }
function stripTrailingCr(value: Buffer): Buffer { return value.length && value[value.length - 1] === 0x0d ? value.subarray(0, -1) : value; }
function positiveInteger(raw: string | undefined, fallback: number): number { const value = Number(raw ?? fallback); return Number.isInteger(value) && value > 0 ? value : fallback; }
function productVersion(root: string): string { try { const parsed = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: unknown }; return typeof parsed.version === 'string' ? parsed.version : 'unknown'; } catch { return process.env.npm_package_version ?? 'unknown'; } }
function isAbort(error: unknown): boolean { return error instanceof Error && error.name === 'AbortError'; }
function abortError(): Error { const error = new Error('MCP request cancelled.'); error.name = 'AbortError'; return error; }
function raceCancellation<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(abortError());
    signal.addEventListener('abort', cancel, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', cancel));
  });
}
