#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { pino } from 'pino';
import { adapterFactory } from './adapters.js';
import { loadConfig } from './config.js';
import { PromptService } from './prompt-service.js';
import { SequenceServiceImpl } from './sequence-service.js';
import { WorkflowServiceImpl } from './workflow-service.js';
import { z } from 'zod';

async function main() {
  const config = loadConfig();
  const logger = pino({
    level: config.LOG_LEVEL,
    transport: {
      target: 'pino-pretty',
    },
  });

  const storageAdapter = adapterFactory(config, logger);
  await storageAdapter.connect();

  const promptService = new PromptService(storageAdapter);
  const sequenceService = new SequenceServiceImpl(storageAdapter);
  const workflowService = new WorkflowServiceImpl();

  const mcpServer = new McpServer({
    name: 'mcp-prompts',
    version: '1.3.0',
  });

  mcpServer.tool(
    'list_prompts',
    'List available prompts',
    z.object({}),
    z.object({}),
    async () => {
      const prompts = await promptService.listPrompts({});
      return { structuredContent: prompts };
    },
  );

  mcpServer.tool(
    'get_prompt',
    'Get a specific prompt by ID',
    z.object({ id: z.string() }),
    z.object({}),
    async (args: { id: string }) => {
      const prompt = await promptService.getPrompt(args.id);
      return { structuredContent: prompt };
    },
  );

  const transports = [
    new StreamableHTTPServerTransport({
      port: config.PORT,
        host: config.HOST,
      server: mcpServer.server,
    }),
  ];

  if (config.ENABLE_SSE) {
    transports.push(
      new SSEServerTransport({
        path: config.SSE_PATH,
        server: mcpServer.server,
      }),
    );
  }

  await mcpServer.connect(transports);

  logger.info(`MCP Prompts server started on ${config.HOST}:${config.PORT}`);

  async function shutdown() {
    logger.info('Shutting down MCP Prompts server...');
    await mcpServer.close();
    await storageAdapter.disconnect();
    logger.info('Server shut down gracefully.');
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
