import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { handleAgenticMcpMessage, TESTIGENT_MCP_PROTOCOL_VERSION } from '../../src/framework/mcp/server.js';
import { invokeAgenticMcpTool, listAgenticMcpTools } from '../../src/framework/mcp/tool-registry.js';
import { resolveMcpRequirementPath } from '../../src/framework/mcp/security-policy.js';

test.describe('Agentic MCP security and protocol contract', () => {
  test('advertises only governed read/review tools and no source promotion tool', () => {
    const names = listAgenticMcpTools().map(tool => tool.name);
    expect(names).toContain('testigent_plan_requirement');
    expect(names).toContain('testigent_review_generation');
    expect(names.some(name => /promote|write|delete|execute/i.test(name))).toBe(false);
  });
  test('implements MCP initialize and tools/list with current protocol', async () => {
    const context = { root: process.cwd(), runId: 'contract-1', environment: 'qa' };
    const initialize = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: TESTIGENT_MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'contract', version: '1' } } }, context);
    expect(initialize && 'result' in initialize ? initialize.result.protocolVersion : undefined).toBe(TESTIGENT_MCP_PROTOCOL_VERSION);
    const list = await handleAgenticMcpMessage({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }, context);
    expect(list && 'result' in list && Array.isArray(list.result.tools)).toBe(true);
  });
  test('requirement path traversal is denied', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-mcp-path-'));
    try {
      fs.mkdirSync(path.join(root, 'projects/demo/requirements'), { recursive: true });
      fs.writeFileSync(path.join(root, 'outside.md'), '# no');
      expect(() => resolveMcpRequirementPath(root, 'demo', '../../../outside.md')).toThrow();
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
  test('project discovery stays inside workspace projects', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'testigent-mcp-projects-'));
    try {
      fs.mkdirSync(path.join(root, 'projects/demo'), { recursive: true });
      fs.writeFileSync(path.join(root, 'projects/demo/project.json'), JSON.stringify({ name: 'Demo' }));
      const output = await invokeAgenticMcpTool('testigent_list_projects', {}, { root, runId: 'contract-2', environment: 'qa' });
      expect(output).toEqual([{ project: 'demo', displayName: 'Demo' }]);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
