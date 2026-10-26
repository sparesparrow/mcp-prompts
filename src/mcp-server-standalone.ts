#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { logger } from './utils.js';
import * as fs from 'fs';
import * as path from 'path';
import { CreatePromptParams, PromptStore, UpdatePromptParams } from './prompt-store.js';

// Report the installed package version rather than a hard-coded one that drifts.
function packageVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export async function createMcpServer() {
  const server = new McpServer({
    name: 'mcp-prompts',
    version: packageVersion(),
  });

  // Each handler validates its own arguments with zod, so the SDK's generic overloads add nothing
  // here except type instantiation too deep for tsc (TS2589) on these schemas.
  const registerTool = server.tool.bind(server) as (...args: unknown[]) => void;

  const store = new PromptStore();
  store.loadDefault();

  // Tool: Add a new prompt
  registerTool(
    'add_prompt',
    'Add a new prompt. Set isTemplate and variables to make it a template that apply_template can fill.',
    CreatePromptParams.shape,
    async (params: unknown) => {
    try {
      const prompt = store.add(CreatePromptParams.parse(params));
      const id = prompt.id;
      return {
        content: [
          {
            type: 'text',
            text: `Prompt "${prompt.name}" added successfully with ID: ${id}`
          }
        ]
      };
    } catch (error) {
      logger.error('Error adding prompt:', error);
      throw new Error(`Failed to add prompt: ${error}`);
    }
  });

  // Tool: Get a prompt by ID
  registerTool(
    'get_prompt',
    'Get a prompt by its ID.',
    { id: z.string().describe('Prompt ID, as returned by list_prompts') },
    async (params: unknown) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(params);
      const prompt = store.get(id);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(prompt, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error getting prompt:', error);
      throw new Error(`Failed to get prompt: ${error}`);
    }
  });

  // Tool: List all prompts
  registerTool(
    'list_prompts',
    'List prompts, optionally filtered by tags (any match) or a search term.',
    {
      tags: z.array(z.string()).optional().describe('Return prompts carrying any of these tags'),
      search: z.string().optional().describe('Text to look for in the name, description or content')
    },
    async (params: unknown) => {
    try {
      const validatedParams = z.object({
        tags: z.array(z.string()).optional(),
        search: z.string().optional()
      }).optional().parse(params);

      const summaryList = store.list({ tags: validatedParams?.tags, search: validatedParams?.search });

      return {
        content: [
          {
            type: 'text',
            text: `Found ${summaryList.length} prompts:\n\n${summaryList.map(p =>
              `- **${p.name}** (${p.id}): ${p.description} [${p.tags.join(', ')}]`
            ).join('\n')}`
          }
        ]
      };
    } catch (error) {
      logger.error('Error listing prompts:', error);
      throw new Error(`Failed to list prompts: ${error}`);
    }
  });

  // Tool: Update a prompt
  registerTool(
    'update_prompt',
    'Update fields of an existing prompt; its version is incremented.',
    { id: z.string().describe('Prompt ID'), updates: UpdatePromptParams },
    async (params: unknown) => {
    try {
      const { id, updates } = z.object({
        id: z.string(),
        updates: UpdatePromptParams
      }).parse(params);

      const updatedPrompt = store.update(id, updates);
      return {
        content: [
          {
            type: 'text',
            text: `Prompt "${updatedPrompt.name}" updated successfully`
          }
        ]
      };
    } catch (error) {
      logger.error('Error updating prompt:', error);
      throw new Error(`Failed to update prompt: ${error}`);
    }
  });

  // Tool: Delete a prompt
  registerTool(
    'delete_prompt',
    'Delete a prompt by its ID.',
    { id: z.string().describe('Prompt ID') },
    async (params: unknown) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(params);
      const prompt = store.delete(id);
      return {
        content: [
          {
            type: 'text',
            text: `Prompt "${prompt.name}" deleted successfully`
          }
        ]
      };
    } catch (error) {
      logger.error('Error deleting prompt:', error);
      throw new Error(`Failed to delete prompt: ${error}`);
    }
  });

  // Tool: Apply template variables to a prompt
  registerTool(
    'apply_template',
    'Fill a template prompt\'s {{variables}} and return the resulting text.',
    {
      id: z.string().describe('ID of a template prompt'),
      variables: z.record(z.string(), z.any()).describe('Values for the template variables, by name')
    },
    async (params: unknown) => {
    try {
      const { id, variables } = z.object({
        id: z.string(),
        variables: z.record(z.string(), z.any())
      }).parse(params);

      const result = store.applyTemplate(id, variables);

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      logger.error('Error applying template:', error);
      throw new Error(`Failed to apply template: ${error}`);
    }
  });

  // Tool: Get prompt statistics
  registerTool(
    'get_stats',
    'Counts of prompts and templates, with the tags and categories in use.',
    async () => {
    try {
      const stats = store.stats();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(stats, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error getting stats:', error);
      throw new Error(`Failed to get stats: ${error}`);
    }
  });

  return server;
}

export async function startMcpServer() {
  const server = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Prompts server started on stdio transport');
  return server;
}

// Start the server when this file is executed directly
startMcpServer().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});