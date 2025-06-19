#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { createStorageAdapter } from './adapters.js';
import { startHttpServer } from './http-server.js';
import { loadConfig } from './config.js';
import { initializeDefaultPrompts } from './data/defaults.js';
import { promptSchemas } from './schemas.js';
import { applyTemplate } from './utils.js';
import { Prompt, StorageAdapter, PromptService, AddPromptInput, EditPromptInput, GetPromptInput, ListPromptsInput, ApplyTemplateInput, PromptSequence } from './interfaces.js';
import { randomUUID } from 'crypto';
import { SequenceServiceImpl } from './sequence-service.js';
import express from 'express';
import { z as orchestratorZ } from 'zod';
import { PromptService as PromptServiceImpl } from './prompt-service.js';

type UpdatePromptInput = z.infer<typeof promptSchemas.update>;

// Orchestrator tool schema and handler
const orchestratorSchema = orchestratorZ.object({
  steps: orchestratorZ.array(
    orchestratorZ.object({
      promptId: orchestratorZ.string(),
      variables: orchestratorZ.record(orchestratorZ.string(), orchestratorZ.any()).optional(),
    })
  ),
});

async function runOrchestratorWorkflow(steps: Array<{ promptId: string; variables?: Record<string, any> }>, promptService: PromptService) {
  const results = [];
  for (const step of steps) {
    const prompt = await promptService.getPrompt(step.promptId);
    if (!prompt) {
      results.push({ error: `Prompt not found: ${step.promptId}` });
      continue;
    }
    if (prompt.isTemplate) {
      const applied = await promptService.applyTemplate(prompt.id, step.variables || {});
      results.push({ id: prompt.id, content: applied.content });
    } else {
      results.push({ id: prompt.id, content: prompt.content });
    }
  }
  return results;
}

/**
 * Main function to initialize and run the MCP Prompts Server.
 */
async function main() {
  const config = loadConfig();
  const storageConfig = {
    type: config.storageType,
    promptsDir: config.promptsDir,
    backupsDir: config.backupsDir,
    postgres: config.postgres,
    elasticsearch: config.elasticsearch
  };
  const storageAdapter = createStorageAdapter(storageConfig);
  const promptService = new PromptServiceImpl(storageAdapter);
  const sequenceService = new SequenceServiceImpl(storageAdapter);

  // Start HTTP server if enabled
  if (config.httpServer) {
    await startHttpServer(
      null,
      {
        port: config.port,
        host: config.host,
        corsOrigin: config.corsOrigin,
        enableSSE: config.enableSSE,
        ssePath: config.ssePath,
      },
      { promptService, sequenceService }
    );
  }

  // Initialize MCP server if enabled
  if (config.mcpServer) {
    const server = new Server({
      name: 'mcp-prompts',
      version: config.version,
      capabilities: {
        prompts: true,
        templates: true,
        sequences: true,
        streaming: true,
        elicitation: true
      },
      tools: [
        {
          name: 'add_prompt',
          handler: async (params: { name: string; content: string; description?: string; isTemplate?: boolean; tags?: string[]; variables?: string[] }) => {
            try {
              const prompt = await promptService.createPrompt({
                ...params,
                isTemplate: params.isTemplate ?? false
              });
              return { success: true, prompt };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        },
        {
          name: 'edit_prompt',
          handler: async (params: { id: string; name?: string; content?: string; description?: string; isTemplate?: boolean; tags?: string[]; variables?: string[] }) => {
            try {
              const prompt = await promptService.updatePrompt(params.id, {
                name: params.name,
                content: params.content,
                description: params.description,
                isTemplate: params.isTemplate ?? false,
                tags: params.tags,
                variables: params.variables
              });
              return { success: true, prompt };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        },
        {
          name: 'get_prompt',
          handler: async (params: { id: string }) => {
            try {
              const prompt = await promptService.getPrompt(params.id);
              return { success: true, prompt };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        },
        {
          name: 'list_prompts',
          handler: async (params: { tags?: string[] }) => {
            try {
              const prompts = await promptService.listPrompts({ tag: params.tags?.[0] });
              return { success: true, prompts };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        },
        {
          name: 'apply_template',
          handler: async (params: { id: string; variables: Record<string, any> }) => {
            try {
              const result = await promptService.applyTemplate(params.id, params.variables);
              return { success: true, result };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        },
        {
          name: 'create_sequence',
          handler: async (params: { name?: string; description?: string }) => {
            try {
              const sequence = await sequenceService.createSequence({
                name: params.name,
                description: params.description
              });
              return { success: true, sequence };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        },
        {
          name: 'orchestrate',
          handler: async (params: { steps: Array<{ promptId: string; variables?: Record<string, any> }> }) => {
            try {
              const results = await runOrchestratorWorkflow(params.steps, promptService);
              return { success: true, results };
            } catch (error) {
              return { success: false, error: error instanceof Error ? error.message : String(error) };
            }
          }
        }
      ]
    });

    // Store transports for each session type
    const transports = {
      streamable: {} as Record<string, StreamableHTTPServerTransport>,
      sse: {} as Record<string, SSEServerTransport>
    };

    // Set up Express app for handling both Streamable HTTP and SSE
    const app = express();
    app.use(express.json());

    // Modern Streamable HTTP endpoint
    app.all('/mcp', async (req, res) => {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID() });
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
        res.json({ success: true, results });
      } catch (error: any) {
        res.status(400).json({ success: false, error: error instanceof Error ? error.message : String(error) });
      }
    });

    // Start the server
    app.listen(config.port, config.host, () => {
      console.log(`MCP server listening on ${config.host}:${config.port}`);
    });
  }
}

// Execute the main function
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});