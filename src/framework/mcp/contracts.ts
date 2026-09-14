export type JsonRpcId = string | number;
export interface JsonRpcRequest { jsonrpc: '2.0'; id: JsonRpcId; method: string; params?: Record<string, unknown>; }
export interface JsonRpcNotification { jsonrpc: '2.0'; method: string; params?: Record<string, unknown>; }
export interface JsonRpcSuccess { jsonrpc: '2.0'; id: JsonRpcId; result: Record<string, unknown>; }
export interface JsonRpcFailure { jsonrpc: '2.0'; id: JsonRpcId | null; error: { code: number; message: string; data?: unknown }; }
export type JsonRpcInbound = JsonRpcRequest | JsonRpcNotification;
export type JsonRpcOutbound = JsonRpcSuccess | JsonRpcFailure;

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean; idempotentHint?: boolean; openWorldHint?: boolean };
}

export interface AgenticMcpContext {
  root: string;
  runId: string;
  environment: string;
  /** Cooperative cancellation propagated from the active MCP JSON-RPC request. */
  abortSignal?: AbortSignal;
}
