/**
 * Prompt Tools for MCP Prompts Server
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { PromptService } from "../services/prompt-service.js";
import { FileAdapter } from "../adapters/file-adapter.js";
import { PostgresAdapter } from "../adapters/postgres-adapter.js";
import { getConfig } from "../config.js";

/**
 * Setup prompt tools for the MCP server
 * @param server MCP Server instance
 */
export async function setupPromptTools(server: McpServer): Promise<void> {
  // Initialize configuration
  const config = getConfig();
  
  // Initialize storage adapter
  let storageAdapter;
  if (config.storage.type === 'file') {
    storageAdapter = new FileAdapter(config.storage.promptsDir);
  } else if (config.storage.type === 'postgres') {
    if (!config.storage.pgConnectionString) {
      throw new Error('PostgreSQL connection string is required for postgres storage');
    }
    storageAdapter = new PostgresAdapter(config.storage.pgConnectionString);
  } else if (config.storage.type === 'memory') {
    throw new Error('Memory adapter not implemented yet');
  } else {
    throw new Error(`Unknown storage type: ${config.storage.type}`);
  }
  
  await storageAdapter.connect();
  
  // Initialize prompt service
  const promptService = new PromptService(storageAdapter);

  // Add prompt tool
  server.tool(
    "add_prompt",
    "Add a new prompt",
    z.object({
      prompt: z.object({
        name: z.string(),
        description: z.string().optional(),
        content: z.string(),
        isTemplate: z.boolean().default(false),
        tags: z.array(z.string()).optional(),
        variables: z.array(z.string()).optional(),
        category: z.string().optional(),
      }),
    }),
    async ({ prompt }) => {
      try {
        const result = await promptService.addPrompt(prompt);
        return {
          content: [{ 
            type: "text", 
            text: `Prompt added with ID: ${result.id}` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error adding prompt: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Get prompt tool
  server.tool(
    "get_prompt",
    "Get a prompt by ID",
    z.object({
      id: z.string(),
    }),
    async ({ id }) => {
      try {
        const prompt = await promptService.getPrompt(id);
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(prompt, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error retrieving prompt: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Update prompt tool
  server.tool(
    "update_prompt",
    "Update an existing prompt",
    z.object({
      id: z.string(),
      prompt: z.object({
        name: z.string().optional(),
        description: z.string().optional(),
        content: z.string().optional(),
        isTemplate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        variables: z.array(z.string()).optional(),
        category: z.string().optional(),
      }),
    }),
    async ({ id, prompt }) => {
      try {
        await promptService.updatePrompt(id, prompt);
        return {
          content: [{ 
            type: "text", 
            text: `Prompt updated successfully` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error updating prompt: ${error.message}` 
          }]
        };
      }
    }
  );

  // List prompts tool
  server.tool(
    "list_prompts",
    "List prompts in the database",
    z.object({
      tags: z.array(z.string()).optional(),
      isTemplate: z.boolean().optional(),
      category: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().int().positive().optional(),
      offset: z.number().int().nonnegative().optional(),
    }),
    async (args) => {
      // Provide default values if args is undefined
      const { 
        tags = undefined, 
        isTemplate = undefined, 
        category = undefined, 
        search = undefined, 
        limit = 50, 
        offset = 0 
      } = args || {};
      
      try {
        const prompts = await promptService.listPrompts({ tags, isTemplate, category, search, limit, offset });
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify(prompts, null, 2) 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error listing prompts: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Apply template tool
  server.tool(
    "apply_template",
    "Apply variables to a prompt template",
    z.object({
      id: z.string(),
      variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
    }),
    async (args) => {
      try {
        const { id, variables } = args;
        const result = await promptService.applyTemplate(id, variables);
        return {
          content: [{ 
            type: "text", 
            text: result.content 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error applying template: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Process prompt tool
  server.tool(
    "process_prompt",
    "Process a template prompt with variables",
    z.object({
      id: z.string(),
      variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
    }),
    async ({ id, variables }) => {
      try {
        const result = await promptService.applyTemplate(id, variables);
        return {
          content: [{ 
            type: "text", 
            text: result.content 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error processing prompt: ${error.message}` 
          }]
        };
      }
    }
  );
  
  // Delete prompt tool
  server.tool(
    "delete_prompt",
    "Delete a prompt by ID",
    z.object({
      id: z.string(),
    }),
    async ({ id }) => {
      try {
        await promptService.deletePrompt(id);
        return {
          content: [{ 
            type: "text", 
            text: `Prompt deleted successfully` 
          }]
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [{ 
            type: "text", 
            text: `Error deleting prompt: ${error.message}` 
          }]
        };
      }
    }
  );
} 