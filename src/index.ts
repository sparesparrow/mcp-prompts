#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import express from 'express';
import type { z } from 'zod';
import { z as orchestratorZ } from 'zod';

import { createStorageAdapter } from './adapters.js';
import { loadConfig } from './config.js';
import { initializeDefaultPrompts } from './data/defaults.js';
import { startHttpServer } from './http-server.js';
import type { PromptService } from './interfaces.js';
import {
  AddPromptInput,
  ApplyTemplateInput,
  EditPromptInput,
  GetPromptInput,
  ListPromptsInput,
  Prompt,
  PromptSequence,
  StorageAdapter,
} from './interfaces.js';
import { PromptService as PromptServiceImpl } from './prompt-service.js';
import type { promptSchemas } from './schemas.js';
import { SequenceServiceImpl } from './sequence-service.js';
import { applyTemplate } from './utils.js';

type UpdatePromptInput = z.infer<typeof promptSchemas.update>;

// Orchestrator tool schema and handler
const orchestratorSchema = orchestratorZ.object({
  steps: orchestratorZ.array(
    orchestratorZ.object({
      promptId: orchestratorZ.string(),
      variables: orchestratorZ.record(orchestratorZ.string(), orchestratorZ.any()).optional(),
    }),
  ),
});

/**
 *
 * @param steps
 * @param promptService
 */
async function runOrchestratorWorkflow(
  steps: Array<{ promptId: string; variables?: Record<string, any> }>,
  promptService: PromptService,
) {
  const results = [];
  for (const step of steps) {
    const prompt = await promptService.getPrompt(step.promptId);
    if (!prompt) {
      results.push({ error: `Prompt not found: ${step.promptId}` });
      continue;
    }
    if (prompt.isTemplate) {
      const applied = await promptService.applyTemplate(prompt.id, step.variables || {});
      results.push({ content: applied.content, id: prompt.id });
    } else {
      results.push({ content: prompt.content, id: prompt.id });
    }
  }
  return results;
}

/**
 * Main function to initialize and run the MCP Prompts Server.
 */
async function main() {
  const config = loadConfig();
  const storageConfig: any = {
    backupsDir: config.BACKUPS_DIR,
    postgres: {
      database: config.POSTGRES_DATABASE,
      host: config.POSTGRES_HOST,
      maxConnections: config.POSTGRES_MAX_CONNECTIONS,
      password: config.POSTGRES_PASSWORD,
      port: config.POSTGRES_PORT,
      ssl: config.POSTGRES_SSL,
      user: config.POSTGRES_USER,
    },
    promptsDir: config.PROMPTS_DIR,
    type: config.STORAGE_TYPE,
  };
  if (config.ELASTICSEARCH_NODE) {
    storageConfig.elasticsearch = {
      auth:
        config.ELASTICSEARCH_USERNAME && config.ELASTICSEARCH_PASSWORD
          ? {
              password: config.ELASTICSEARCH_PASSWORD,
              username: config.ELASTICSEARCH_USERNAME,
            }
          : undefined,
      index: config.ELASTICSEARCH_INDEX,
      node: config.ELASTICSEARCH_NODE,
      sequenceIndex: config.ELASTICSEARCH_SEQUENCE_INDEX,
    };
  }
  const storageAdapter = createStorageAdapter(storageConfig);
  const promptService = new PromptServiceImpl(storageAdapter);
  const sequenceService = new SequenceServiceImpl(storageAdapter);

  // Start HTTP server if enabled
  if (config.HTTP_SERVER) {
    await startHttpServer(
      null,
      {
        corsOrigin: config.CORS_ORIGIN,
        enableSSE: config.ENABLE_SSE,
        host: config.HOST,
        port: config.PORT,
        ssePath: config.SSE_PATH,
      },
      { promptService, sequenceService },
    );
  }

  // Initialize MCP server if enabled
  if (config.MCP_SERVER) {
    const server = new Server({
      capabilities: {
        elicitation: true,
        prompts: true,
        sequences: true,
        streaming: true,
        templates: true,
      },
      name: config.NAME || 'mcp-prompts',
      tools: [
        {
          handler: async (params: {
            name: string;
            content: string;
            description?: string;
            isTemplate?: boolean;
            tags?: string[];
            variables?: string[];
          }) => {
            try {
              const prompt = await promptService.createPrompt({
                ...params,
                isTemplate: params.isTemplate ?? false,
              });
              return { prompt, success: true };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                success: false,
              };
            }
          },
          name: 'add_prompt',
        },
        {
          handler: async (params: {
            id: string;
            name?: string;
            content?: string;
            description?: string;
            isTemplate?: boolean;
            tags?: string[];
            variables?: string[];
          }) => {
            try {
              const prompt = await promptService.updatePrompt(params.id, {
                content: params.content,
                description: params.description,
                isTemplate: params.isTemplate ?? false,
                name: params.name,
                tags: params.tags,
                variables: params.variables,
              });
              return { prompt, success: true };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                success: false,
              };
            }
          },
          name: 'edit_prompt',
        },
        {
          handler: async (params: { id: string }) => {
            try {
              const prompt = await promptService.getPrompt(params.id);
              return { prompt, success: true };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                success: false,
              };
            }
          },
          name: 'get_prompt',
        },
        {
          handler: async (params: { tags?: string[] }) => {
            try {
              const prompts = await promptService.listPrompts({ tag: params.tags?.[0] });
              return { prompts, success: true };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                success: false,
              };
            }
          },
          name: 'list_prompts',
        },
        {
          handler: async (params: { id: string; variables: Record<string, any> }) => {
            try {
              const result = await promptService.applyTemplate(params.id, params.variables);
              return { result, success: true };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                success: false,
              };
            }
          },
          name: 'apply_template',
        },
        {
          handler: async (params: { name?: string; description?: string }) => {
            try {
              const sequence = await sequenceService.createSequence({
                description: params.description,
                name: params.name,
              });
              return { sequence, success: true };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                success: false,
              };
            }
          },
          name: 'create_sequence',
        },
        {
          handler: async (params: {
            steps: Array<{ promptId: string; variables?: Record<string, any> }>;
          }) => {
            try {
              const results = await runOrchestratorWorkflow(params.steps, promptService);
              return { results, success: true };
            } catch (error) {
              return {
                error: error instanceof Error ? error.message : String(error),
                success: false,
              };
            }
          },
          name: 'orchestrate',
        },
      ],
      version: config.VERSION || '1.0.0',
    });

    // Store transports for each session type
    const transports = {
      sse: {} as Record<string, SSEServerTransport>,
      streamable: {} as Record<string, StreamableHTTPServerTransport>,
    };

    // Set up Express app for handling both Streamable HTTP and SSE
    const app = express();
    app.use(express.json());

    // Modern Streamable HTTP endpoint
    app.all('/mcp', async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      await server.connect(transport);
    });

    // Legacy SSE endpoint for older clients
    app.get('/sse', async (req, res) => {
      const transport = new SSEServerTransport('/messages', res);
      transports.sse[transport.sessionId] = transport;

      res.on('close', () => {
        delete transports.sse[transport.sessionId];
      });

      await server.connect(transport);
    });

    // Legacy message endpoint for older clients
    app.post('/messages', async (req, res) => {
      const sessionId = req.query.sessionId as string;
      const transport = transports.sse[sessionId];
      if (transport) {
        await transport.handlePostMessage(req, res, req.body);
      } else {
        res.status(400).send('No transport found for sessionId');
      }
    });

    // Orchestrator endpoint
    app.post('/orchestrator', async (req, res) => {
      try {
        const parsed = orchestratorSchema.parse(req.body);
        const results = await runOrchestratorWorkflow(parsed.steps, promptService);
        res.json({ results, success: true });
      } catch (error: any) {
        res
          .status(400)
          .json({ error: error instanceof Error ? error.message : String(error), success: false });
      }
    });

    // Start the server
    app.listen(config.PORT, config.HOST, () => {
      console.log(`MCP server listening on ${config.HOST}:${config.PORT}`);
    });
  }
}

// Execute the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
