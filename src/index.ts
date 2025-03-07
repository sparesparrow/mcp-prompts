/**
 * MCP Prompts Server
 * Main entry point for the MCP Prompts Server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PromptService } from "./services/prompt-service.js";
import { FileAdapter } from "./adapters/file-adapter.js";
import { getConfig, validateConfig } from "./config.js";

/**
 * Main entry point for the MCP Prompts server
 */
async function main() {
  try {
    // Load and validate configuration
    const config = getConfig();
    validateConfig(config);
    
    // Create MCP server
    const server = new Server({
      name: config.server.name,
      version: config.server.version,
    });
    
    // Initialize storage adapter
    let storageAdapter;
    if (config.storage.type === 'file') {
      storageAdapter = new FileAdapter(config.storage.promptsDir);
    } else if (config.storage.type === 'postgres') {
      throw new Error('PostgreSQL adapter not implemented yet');
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
      {
        prompt: z.object({
          name: z.string(),
          description: z.string().optional(),
          content: z.string(),
          isTemplate: z.boolean().default(false),
          tags: z.array(z.string()).optional(),
          category: z.string().optional()
        })
      },
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
      {
        id: z.string()
      },
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
      {
        id: z.string(),
        prompt: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          content: z.string().optional(),
          isTemplate: z.boolean().optional(),
          tags: z.array(z.string()).optional(),
          category: z.string().optional()
        })
      },
      async ({ id, prompt }) => {
        try {
          const result = await promptService.updatePrompt(id, prompt);
          return {
            content: [{ 
              type: "text", 
              text: `Prompt updated: ${result.id}` 
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
      {
        tags: z.array(z.string()).optional(),
        isTemplate: z.boolean().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        sort: z.string().optional(),
        order: z.enum(['asc', 'desc']).optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional()
      },
      async (options) => {
        try {
          const prompts = await promptService.listPrompts(options);
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
      {
        id: z.string(),
        variables: z.record(z.union([z.string(), z.number(), z.boolean()]))
      },
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
              text: `Error applying template: ${error.message}` 
            }]
          };
        }
      }
    );
    
    // Delete prompt tool
    server.tool(
      "delete_prompt",
      {
        id: z.string()
      },
      async ({ id }) => {
        try {
          await promptService.deletePrompt(id);
          return {
            content: [{ 
              type: "text", 
              text: `Prompt deleted: ${id}` 
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
    
    // Connect to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("MCP Prompts server started");
  } catch (error: any) {
    console.error("Error starting server:", error.message);
    process.exit(1);
  }
}

// Start the server
main();