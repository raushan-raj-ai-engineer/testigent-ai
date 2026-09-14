import { startAgenticMcpTransport } from '../../src/framework/mcp/server.js';

startAgenticMcpTransport(process.stdin, process.stdout, { root: process.cwd(), runId: 'mcp-stdio-contract', environment: 'qa' }, {
  maxBytes: 512,
  maxConcurrency: 1,
  listTools: () => [],
  invokeTool: async (name, _args, context) => {
    if (name !== 'slow') return { ok: true };
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 10_000);
      const cancel = () => {
        clearTimeout(timer);
        const error = new Error('cancelled by transport'); error.name = 'AbortError'; reject(error);
      };
      if (context.abortSignal?.aborted) return cancel();
      context.abortSignal?.addEventListener('abort', cancel, { once: true });
    });
    return { completed: true };
  },
});
