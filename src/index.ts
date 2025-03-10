/**
 * MCP Prompts Server
 * Main entry point for the MCP Prompts Server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { PromptService } from "./services/prompt-service.js";
import { FileAdapter } from "./adapters/file-adapter.js";
import { PostgresAdapter } from "./adapters/postgres-adapter.js";
import { getConfig, validateConfig } from "./config.js";
import { setupDatabaseTools } from "./tools/database-tools.js";
import { setupProjectOrchestratorTools } from "./tools/project-orchestrator-tools.js";

/**
 * Main entry point for the MCP Prompts server
 */
async function main() {
  try {
    // Load and validate configuration
    const config = getConfig();
    validateConfig(config);
    
    // Create MCP server
    const server = new McpServer({
      name: config.server.name,
      version: config.server.version,
    });
    
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
      {
        prompt: z.object({
          name: z.string(),
          description: z.string().optional(),
          content: z.string(),
          isTemplate: z.boolean().default(false),
          tags: z.array(z.string()).optional(),
          variables: z.array(z.string()).optional(),
          category: z.string().optional(),
        }),
      },
      async (args) => {
        try {
          const { prompt } = args;
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
      {
        id: z.string(),
      },
      async (args) => {
        try {
          const { id } = args;
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
      {
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
      },
      async (args) => {
        try {
          const { id, prompt } = args;
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
      "List all prompts",
      {
        tags: z.array(z.string()).optional(),
        isTemplate: z.boolean().optional(),
        category: z.string().optional(),
        search: z.string().optional(),
        sort: z.string().optional(),
        order: z.enum(['asc', 'desc']).optional(),
        limit: z.number().int().positive().optional(),
        offset: z.number().int().nonnegative().optional(),
      },
      async (args) => {
        try {
          const options = args;
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
      "Apply variables to a prompt template",
      {
        id: z.string(),
        variables: z.record(z.union([z.string(), z.number(), z.boolean()])),
      },
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
    
    // Delete prompt tool
    server.tool(
      "delete_prompt",
      "Delete a prompt",
      {
        id: z.string(),
      },
      async (args) => {
        try {
          const { id } = args;
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
    
    // Setup database tools
    setupDatabaseTools(server);
    
    // Setup project orchestrator tools
    setupProjectOrchestratorTools(server);
    
    // Start the server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log(`MCP Prompts server started`);
  } catch (error) {
    console.error('Failed to start MCP Prompts server:', error);
    process.exit(1);
  }
}

main();