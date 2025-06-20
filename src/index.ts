#!/usr/bin/env node

import { Server, type ServerTool } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'crypto';
import express from 'express';
import type { z } from 'zod';
import { z as orchestratorZ } from 'zod';

import {
  FileAdapter,
  MdcAdapter,
  MemoryAdapter,
  PostgresAdapter,
  type StorageAdapter,
} from './adapters.js';
import { loadConfig } from './config.js';
import { startHttpServer } from './http-server.js';
import {
  AddPromptInput,
  ApplyTemplateInput,
  EditPromptInput,
  GetPromptInput,
  ListPromptsInput,
  Prompt,
  PromptSequence,
} from './interfaces.js';
import { PromptService } from './prompt-service.js';
import type { promptSchemas } from './schemas.js';
import { SequenceServiceImpl } from './sequence-service.js';
import { applyTemplate } from './utils.js';
import { WorkflowServiceImpl } from './workflow-service.js';

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
 * @param config
 */
function createStorageAdapter(config: any): StorageAdapter {
  switch (config.STORAGE_TYPE) {
    case 'file':
      return new FileAdapter(config.PROMPTS_DIR);
    case 'postgres':
      return new PostgresAdapter({
        database: config.POSTGRES_DATABASE,
        host: config.POSTGRES_HOST,
        maxConnections: config.POSTGRES_MAX_CONNECTIONS,
        password: config.POSTGRES_PASSWORD,
        port: config.POSTGRES_PORT,
        ssl: config.POSTGRES_SSL,
        user: config.POSTGRES_USER,
      });
    case 'mdc':
      return new MdcAdapter(config.PROMPTS_DIR);
    case 'memory':
    default:
      return new MemoryAdapter();
  }
}

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
 *
 * @param handler
 * @param name
 */
function createTool<T>(
  handler: (params: T, services: { promptService: PromptService }) => Promise<any>,
  name: string,
): ServerTool<T> {
  return {
    handler: async (
      params: T,
      _server,
      _call,
      { context }: { context: { promptService: PromptService } },
    ) => {
      try {
        const result = await handler(params, context);
        return { success: true, ...result };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    },
    name,
  };
}

/**
 *
 * @param config
 * @param promptService
 * @param sequenceService
 * @param workflowService
 */
async function startMcpServer(
  config: any,
  promptService: PromptService,
  sequenceService: SequenceServiceImpl,
  workflowService: WorkflowServiceImpl,
) {
  const transports = [];
  if (config.SSE_SERVER_TRANSPORT) {
    transports.push(new SSEServerTransport({ port: config.SSE_PORT }));
  }
  if (config.HTTP_SERVER_TRANSPORT) {
    transports.push(new StreamableHTTPServerTransport({ port: config.HTTP_PORT }));
  }

  const server = new Server({
    capabilities: {
      elicitation: true,
      prompts: true,
      sequences: true,
      streaming: true,
      templates: true,
    },
    context: { promptService, sequenceService, workflowService },
    name: config.NAME || 'mcp-prompts',
    tools: [
      createTool(
        (params: {
          name: string;
          content: string;
          description?: string;
          isTemplate?: boolean;
          tags?: string[];
          variables?: string[];
        }) =>
          promptService.createPrompt({
            ...params,
            isTemplate: params.isTemplate ?? false,
          }),
        'add_prompt',
      ),
      createTool(
        (params: {
          id: string;
          name?: string;
          content?: string;
          description?: string;
          isTemplate?: boolean;
          tags?: string[];
          variables?: string[];
        }) =>
          promptService.updatePrompt(params.id, {
            content: params.content,
            description: params.description,
            isTemplate: params.isTemplate ?? false,
            name: params.name,
            tags: params.tags,
            variables: params.variables,
          }),
        'edit_prompt',
      ),
      createTool((params: { id: string }) => promptService.getPrompt(params.id), 'get_prompt'),
      createTool(
        (params: { id: string }) => promptService.deletePrompt(params.id),
        'delete_prompt',
      ),
      createTool(
        (params: {
          isTemplate?: boolean;
          tags?: string[];
          category?: string;
          search?: string;
          page?: number;
          pageSize?: number;
        }) => promptService.listPrompts(params),
        'list_prompts',
      ),
      createTool(
        (params: { id: string; variables: Record<string, any> }) =>
          promptService.applyTemplate(params.id, params.variables),
        'apply_template',
      ),
      createTool(
        (params: { steps: Array<{ promptId: string; variables?: Record<string, any> }> }) =>
          runOrchestratorWorkflow(params.steps, promptService),
        'run_workflow',
      ),
    ],
    transports,
  });

  await server.start();
  console.log(`MCP server started. Name: ${server.name}`);
  server.transports.forEach(transport => {
    console.log(`  - Transport: ${transport.constructor.name} ready.`);
  });
}

/**
 * Main function to initialize and run the MCP Prompts Server.
 */
async function main() {
  const config = loadConfig();
  const adapter = createStorageAdapter(config);
  await adapter.connect();

  const promptService = new PromptService(adapter);
  const sequenceService = new SequenceServiceImpl(adapter);
  const workflowService = new WorkflowServiceImpl();

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
      { promptService, sequenceService, workflowService },
    );
  }

  // Initialize MCP server if enabled
  if (config.MCP_SERVER) {
    await startMcpServer(config, promptService, sequenceService, workflowService);
  }

  if (!config.HTTP_SERVER && !config.MCP_SERVER) {
    console.error('No servers enabled. Please enable HTTP_SERVER or MCP_SERVER.');
    process.exit(1);
  }
}

// Execute the main function
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
