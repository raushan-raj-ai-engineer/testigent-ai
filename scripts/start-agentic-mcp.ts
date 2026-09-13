import 'dotenv/config';
import { startAgenticMcpServer } from '../src/framework/mcp/server.js';

/** Starts the governed TestigentAI Agentic Test Intelligence MCP server over stdio. */
function main(): void {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  startAgenticMcpServer({
    root: process.cwd(),
    runId: process.env.RUN_ID?.trim() || `mcp-${timestamp}`,
    environment: process.env.ENV?.trim() || 'qa',
  });
}
main();
