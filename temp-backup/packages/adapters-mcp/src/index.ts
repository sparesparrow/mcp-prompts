#!/usr/bin/env node

// TEMPORARY WORKAROUND: Unblock typechecking for MCP SDK
// @ts-ignore
import { MCPServer } from '@modelcontextprotocol/sdk';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  PromptSchema,
  PromptIdSchema,
} from './schemas.js';
import type { IPromptApplication } from '@sparesparrow/mcp-prompts-core';

export function startMcpServer(promptApp: IPromptApplication) {
  const server = new McpServer({
    name: 'mcp-prompts-server',
    version: '3.0.0',
  });

  // Register tools using new idiom
  server.tool(
    'addPrompt',
    PromptSchema,
    async (input) => ({ content: [await promptApp.addPrompt(input)] })
  );

  server.tool(
    'getPromptById',
    z.object({ id: PromptIdSchema }),
    async ({ id }) => ({ content: [await promptApp.getPromptById(id)] })
  );

  server.tool(
    'listPrompts',
    z.void(),
    async () => ({ content: await promptApp.listPrompts() })
  );

  // Add more tools/resources as needed

  // Use Stdio transport by default
  const transport = process.env.MCP_TRANSPORT || 'stdio';
  if (transport === 'stdio') {
    server.listen(new StdioServerTransport());
  }
  // Add HTTP transport if needed (future)

  return server;
}
