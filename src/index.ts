#!/usr/bin/env node
console.log('Starting MCP Prompts Server...');

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
// import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { pino } from 'pino';
import { z } from 'zod';

import { adapterFactory } from './adapters.js';
import { loadConfig } from './config.js';
import { ElevenLabsService } from './elevenlabs-service.js';
import { startHttpServer } from './http-server.js';
import { PromptService } from './prompt-service.js';
import { SequenceServiceImpl } from './sequence-service.js';
import { WorkflowServiceImpl } from './workflow-service.js';

/**
 *
 */
async function main() {
  const env = loadConfig();
  const logger = pino({
    level: env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        options: {
          colorize: true,
        },
        target: 'pino-pretty',
      },
    }),
  });

  const config = {
    ...env,
    storage: {
      database: env.POSTGRES_DATABASE,
      host: env.POSTGRES_HOST,
      maxConnections: env.POSTGRES_MAX_CONNECTIONS,
      password: env.POSTGRES_PASSWORD,
      port: env.POSTGRES_PORT,
      promptsDir: env.PROMPTS_DIR,
      ssl: env.POSTGRES_SSL,
      type: env.STORAGE_TYPE,
      user: env.POSTGRES_USER,
    },
  };

  const storageAdapter = adapterFactory(config, logger);
  await storageAdapter.connect();

  const promptService = new PromptService(storageAdapter);
  const sequenceService = new SequenceServiceImpl(storageAdapter);
  const workflowService = new WorkflowServiceImpl(storageAdapter, promptService);
  const elevenLabsService = new ElevenLabsService({
    apiKey: env.ELEVENLABS_API_KEY || '',
    cacheDir: env.ELEVENLABS_CACHE_DIR,
    model: env.ELEVENLABS_MODEL_ID,
    voiceId: env.ELEVENLABS_VOICE_ID,
  });

  const mcpServer = new McpServer({
    name: 'mcp-prompts',
    version: '1.3.0',
  });

  await startHttpServer(
    mcpServer,
    {
      corsOrigin: env.CORS_ORIGIN,
      enableSSE: env.ENABLE_SSE,
      host: env.HOST,
      port: env.PORT,
      ssePath: env.SSE_PATH,
    },
    {
      elevenLabsService,
      promptService,
      sequenceService,
      storageAdapters: [storageAdapter],
      workflowService,
    },
  );

  // mcpServer.tool('list_prompts', 'List available prompts', z.object({}), z.object({}), async () => {
  //   const prompts = await promptService.listPrompts({});
  //   return { structuredContent: prompts };
  // });

  // mcpServer.tool(
  //   'get_prompt',
  //   'Get a specific prompt by ID',
  //   z.object({ id: z.string() }),
  //   z.object({}),
  //   async (args: { id: string }) => {
  //     const prompt = await promptService.getPrompt(args.id);
  //     return { structuredContent: prompt };
  //   },
  // );

  logger.info(`MCP Prompts server started on ${env.HOST}:${env.PORT}`);

  /**
   *
   */
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
