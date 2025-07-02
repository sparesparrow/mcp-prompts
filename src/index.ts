#!/usr/bin/env node
console.log('Starting MCP Prompts Server...');

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
// import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse';
// import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp';
import { pino } from 'pino';
import { z } from 'zod';
import http from 'http';

import { adapterFactory } from './adapters.js';
import { loadConfig } from './config.js';
import { ElevenLabsService } from './elevenlabs-service.js';
import { startHttpServer } from './http-server.js';
import { PromptService } from './prompt-service.js';
import { SequenceApplication, ISequenceRepository } from './sequence-service.js';
import { WorkflowApplication } from './workflow-service.js';
import { defaultTemplatingEngine } from './utils.js';

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

  const allowedStorageTypes = ['file', 'postgres', 'memory'] as const;
  type AllowedStorageType = typeof allowedStorageTypes[number];
  const storageType: AllowedStorageType = allowedStorageTypes.includes(env.STORAGE_TYPE as AllowedStorageType)
    ? (env.STORAGE_TYPE as AllowedStorageType)
    : 'file';
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
      type: storageType,
      user: env.POSTGRES_USER,
    } as {
      database: string | undefined;
      host: string | undefined;
      maxConnections: number | undefined;
      password: string | undefined;
      port: number | undefined;
      promptsDir: string;
      ssl: boolean | undefined;
      type: AllowedStorageType;
      user: string | undefined;
    },
  };

  const storageAdapter = adapterFactory(config, logger);
  await storageAdapter.connect();

  const promptService = new PromptService(storageAdapter, defaultTemplatingEngine);
  const sequenceService = new SequenceApplication(storageAdapter as ISequenceRepository);
  const workflowService = new WorkflowApplication(storageAdapter, promptService);
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

  let httpServer: http.Server;
  try {
    httpServer = await startHttpServer(
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

    logger.info(`MCP Prompts server started on ${env.HOST}:${env.PORT}`);

    // Keep the event loop alive
    const keepAlive = setInterval(() => {}, 1000);

    /**
     * Graceful shutdown handler
     */
    async function shutdown() {
      logger.info('Shutting down MCP Prompts server...');
      clearInterval(keepAlive);
      await mcpServer.close();
      await new Promise<void>((resolve) => {
        if (httpServer.listening) {
          httpServer.close(() => resolve());
        } else {
          resolve();
        }
      });
      await storageAdapter.disconnect();
      logger.info('Server shut down gracefully.');
      process.exit(0);
    }

    // Handle process signals
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception:', error);
      shutdown().catch((err) => {
        logger.error('Error during shutdown:', err);
        process.exit(1);
      });
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection:', reason);
      shutdown().catch((err) => {
        logger.error('Error during shutdown:', err);
        process.exit(1);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
