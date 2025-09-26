#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { logger } from './utils';
import * as fs from 'fs';
import * as path from 'path';

// Define the prompt schema
const PromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  isTemplate: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  variables: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      description: z.string().optional(),
      required: z.boolean().default(true),
      type: z.enum(['string', 'number', 'boolean']).default('string')
    })
  ])).optional(),
  metadata: z.record(z.any()).optional()
});

const CreatePromptParams = PromptSchema.omit({ id: true });
const UpdatePromptParams = PromptSchema.partial().omit({ id: true });

// In-memory storage for prompts
const prompts = new Map();

// Load sample prompts on startup
function loadSamplePrompts() {
  try {
    const sampleDataPath = path.join(process.cwd(), 'data', 'sample-prompts.json');
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    for (const prompt of sampleData.prompts) {
      prompts.set(prompt.id, {
        ...prompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      });
    }
    logger.info(`Loaded ${sampleData.prompts.length} sample prompts`);
  } catch (error) {
    logger.warn('Could not load sample prompts:', error);
  }
}

export async function createMcpServer() {
  const server = new McpServer({
    name: 'mcp-prompts',
    version: '3.0.9',
  });

  // Load sample prompts
  loadSamplePrompts();

  // Tool: Add a new prompt
  server.tool('add_prompt', async (params) => {
    try {
      const validatedParams = CreatePromptParams.parse(params);
      const id = `prompt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      const prompt = {
        ...validatedParams,
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      };
      prompts.set(id, prompt);
      logger.info(`Added prompt: ${id}`);
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
  server.tool('get_prompt', async (params) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(params);
      const prompt = prompts.get(id);
      if (!prompt) {
        throw new Error(`Prompt with ID ${id} not found`);
      }
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
  server.tool('list_prompts', async (params) => {
    try {
      const validatedParams = z.object({
        tags: z.array(z.string()).optional(),
        search: z.string().optional()
      }).optional().parse(params);

      let promptList = Array.from(prompts.values());

      // Filter by tags if provided
      if (validatedParams?.tags && validatedParams.tags.length > 0) {
        promptList = promptList.filter(prompt => 
          validatedParams.tags!.some(tag => prompt.tags.includes(tag))
        );
      }

      // Filter by search term if provided
      if (validatedParams?.search) {
        const searchLower = validatedParams.search.toLowerCase();
        promptList = promptList.filter(prompt => 
          prompt.name.toLowerCase().includes(searchLower) ||
          prompt.content.toLowerCase().includes(searchLower)
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(promptList, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error listing prompts:', error);
      throw new Error(`Failed to list prompts: ${error}`);
    }
  });

  // Tool: Update a prompt
  server.tool('update_prompt', async (params) => {
    try {
      const { id, updates } = z.object({
        id: z.string(),
        updates: UpdatePromptParams
      }).parse(params);

      const prompt = prompts.get(id);
      if (!prompt) {
        throw new Error(`Prompt with ID ${id} not found`);
      }

      const updatedPrompt = {
        ...prompt,
        ...updates,
        updatedAt: new Date().toISOString(),
        version: prompt.version + 1
      };

      prompts.set(id, updatedPrompt);
      logger.info(`Updated prompt: ${id}`);
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
  server.tool('delete_prompt', async (params) => {
    try {
      const { id } = z.object({ id: z.string() }).parse(params);
      const prompt = prompts.get(id);
      if (!prompt) {
        throw new Error(`Prompt with ID ${id} not found`);
      }
      prompts.delete(id);
      logger.info(`Deleted prompt: ${id}`);
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
  server.tool('apply_template', async (params) => {
    try {
      const { id, variables } = z.object({
        id: z.string(),
        variables: z.record(z.any())
      }).parse(params);

      const prompt = prompts.get(id);
      if (!prompt) {
        throw new Error(`Prompt with ID ${id} not found`);
      }

      if (!prompt.isTemplate) {
        throw new Error(`Prompt "${prompt.name}" is not a template`);
      }

      let result = prompt.content;
      // Simple variable substitution
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        result = result.replace(new RegExp(placeholder, 'g'), String(value));
      }

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
  server.tool('get_stats', async () => {
    try {
      const promptList = Array.from(prompts.values());
      const stats = {
        total: promptList.length,
        templates: promptList.filter(p => p.isTemplate).length,
        regular: promptList.filter(p => !p.isTemplate).length,
        tags: Array.from(new Set(promptList.flatMap(p => p.tags || []))),
        categories: Array.from(new Set(promptList.map(p => p.metadata?.category).filter(Boolean)))
      };

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
if (require.main === module) {
  startMcpServer().catch((error) => {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}