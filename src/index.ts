#!/usr/bin/env node
// @ts-nocheck
/* eslint-disable */
// Tell TypeScript to keep this as an ES module
// @ts-ignore
export {};
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { createStorageAdapter } from "./adapters.js";
import { Prompt, ServerConfig, StorageAdapter } from "./interfaces/index.js";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { FileStorageAdapter, MemoryStorageAdapter, PostgresStorageAdapter } from './adapters/index.js';
import { startHttpServer } from './http-server.js';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration with defaults
const DEFAULT_CONFIG: ServerConfig = {
  name: "mcp-prompts",
  version: "1.0.0",
  storageType: "file",
  promptsDir: process.env.PROMPTS_DIR || path.join(process.cwd(), "prompts"),
  backupsDir: process.env.BACKUPS_DIR || path.join(process.cwd(), "backups"),
  port: Number(process.env.PORT) || 3003,
  logLevel: (process.env.LOG_LEVEL || "info") as "debug" | "info" | "warn" | "error",
  httpServer: process.env.HTTP_SERVER === "true",
  host: process.env.HOST || "0.0.0.0",
  postgres: process.env.POSTGRES_CONNECTION_STRING 
    ? {
        connectionString: process.env.POSTGRES_CONNECTION_STRING,
        host: "",
        port: 5432,
        database: "",
        user: "",
        password: "",
        ssl: false
      } 
    : {
        host: process.env.POSTGRES_HOST || "localhost",
        port: Number(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || "mcp_prompts",
        user: process.env.POSTGRES_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD || "postgres",
        ssl: process.env.POSTGRES_SSL === "true"
      }
};

// Storage adapter instance
let storageAdapter: StorageAdapter;

// Default prompts to include when initializing
const DEFAULT_PROMPTS: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'version'>[] = [
  {
    name: "Development System Prompt",
    description: "A template for creating system prompts for development assistance",
    content: `You are a development assistant helping with {{project_type}} development using {{language}}. 

Role:
- You provide clear, concise code examples with explanations
- You suggest best practices and patterns
- You help debug issues with the codebase

The current project is {{project_name}} which aims to {{project_goal}}.

When providing code examples:
1. Use consistent style and formatting
2. Include comments for complex sections
3. Follow {{language}} best practices
4. Consider performance implications

Technical context:
{{technical_context}}`,
    isTemplate: true,
    variables: ["project_type", "language", "project_name", "project_goal", "technical_context"],
    tags: ["development", "system", "template"]
  },
  {
    name: "Task List Helper",
    description: "A basic prompt to help organize and prioritize tasks",
    content: "Please create a prioritized task list based on the following requirements:\n\n{{requirements}}",
    isTemplate: true,
    variables: ["requirements"],
    tags: ["productivity", "planning"]
  }
];

// Initialize default prompts
async function initializeDefaultPrompts() {
  try {
    console.error("Adding default prompts...");
    const existingPrompts = await storageAdapter.listPrompts();
  
    if (existingPrompts.length === 0) {
      for (const promptData of DEFAULT_PROMPTS) {
        await storageAdapter.savePrompt(promptData);
      }
      console.error(`Added ${DEFAULT_PROMPTS.length} default prompts`);
    } else {
      console.error(`Skipping default prompts, ${existingPrompts.length} prompts already exist`);
    }
  } catch (error) {
    console.error("Error initializing default prompts:", error);
  }
}

// Utility to apply template variables
function applyTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    return variables[variable.trim()] || match;
  });
}

// Main function
async function main() {
  try {
    console.error(`Starting MCP Prompts Server v${DEFAULT_CONFIG.version}`);
    console.error(`Config: ${JSON.stringify(DEFAULT_CONFIG)}`);
    
    // Create and connect to storage
    storageAdapter = await createStorageAdapter(DEFAULT_CONFIG);
    await storageAdapter.connect();
    
    // Initialize default prompts
    await initializeDefaultPrompts();
  
    // Create MCP server
    const server = new McpServer(
      {
        name: DEFAULT_CONFIG.name,
        version: DEFAULT_CONFIG.version,
      },
      {
        capabilities: {
          resources: { subscribe: false },
          tools: { listChanged: false },
          prompts: { listChanged: false }
        }
      }
    );
    
    // Define resources
    const resourcesList = [
      {
        id: "prompt",
        name: "Prompt",
        description: "A prompt or template stored in the system",
        resourcePattern: "prompt://{id}",
        listPattern: "prompt://",
      },
      {
        id: "templates",
        name: "Templates",
        description: "All available template prompts",
        resourcePattern: "templates://",
        listPattern: undefined,
      }
    ];

    // Register the resources/list method handler
    server.tool(
      "resources/list",
      {},
      async () => {
        return {
          type: "object",
          object: {
            resources: resourcesList
          }
        };
      }
    );

    // Register the prompts/list method handler
    server.tool(
      "prompts/list",
      {},
      async () => {
        const prompts = await storageAdapter.listPrompts();
        return {
          type: "object",
          object: {
          prompts: prompts.map(prompt => ({
            id: prompt.id,
            name: prompt.name,
            description: prompt.description || "",
            isTemplate: prompt.isTemplate || false
          }))
          }
        };
      }
    );

    // Register the tools/list method handler
    server.tool(
      "tools/list",
      {},
      async () => {
        return {
        type: "object",
        object: {
          tools: [
            {
              name: "add_prompt",
              description: "Add a new prompt",
              parameters: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  content: { type: "string" },
                  description: { type: "string", optional: true },
                  isTemplate: { type: "boolean", optional: true },
                  variables: { type: "array", items: { type: "string" }, optional: true },
                  tags: { type: "array", items: { type: "string" }, optional: true }
                },
                required: ["name", "content"]
              }
            },
            {
              name: "get_prompt",
              description: "Get a prompt by ID",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" }
                },
                required: ["id"]
              }
            },
            {
              name: "update_prompt",
              description: "Update a prompt",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  name: { type: "string", optional: true },
                  content: { type: "string", optional: true },
                  description: { type: "string", optional: true },
                  isTemplate: { type: "boolean", optional: true },
                  variables: { type: "array", items: { type: "string" }, optional: true },
                  tags: { type: "array", items: { type: "string" }, optional: true }
                },
                required: ["id"]
              }
            },
            {
              name: "list_prompts",
              description: "List all prompts with optional filtering",
              parameters: {
                type: "object",
                properties: {
                  isTemplate: { type: "boolean", optional: true },
                  tags: { type: "array", items: { type: "string" }, optional: true },
                  search: { type: "string", optional: true },
                  limit: { type: "number", optional: true },
                  offset: { type: "number", optional: true }
                }
              }
            },
            {
              name: "delete_prompt",
              description: "Delete a prompt",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" }
                },
                required: ["id"]
              }
            },
            {
              name: "apply_template",
              description: "Apply variables to a template",
              parameters: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  variables: { type: "object" }
                },
                required: ["id", "variables"]
              }
            }
          ]
        }};
      }
    );

    // Register tool handlers
    server.tool(
      "add_prompt",
      {
        name: z.string(),
        content: z.string(),
        description: z.string().optional(),
        isTemplate: z.boolean().optional(),
        variables: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      },
      async (params) => {
        const prompt = await storageAdapter.savePrompt({
          name: params.name,
          content: params.content,
          description: params.description,
          isTemplate: params.isTemplate || false,
          variables: params.variables || [],
          tags: params.tags || [],
        });
        
        return {
          type: "object",
          object: prompt,
      };
    }
  );

  server.tool(
    "get_prompt",
    {
        id: z.string(),
      },
      async (params) => {
        try {
          const prompt = await storageAdapter.getPrompt(params.id);
          return {
            type: "object",
            object: prompt,
          };
        } catch (error) {
        return {
            type: "error",
            error: `Prompt not found: ${params.id}`,
          };
        }
      }
    );
    
    server.tool(
      "update_prompt",
      {
        id: z.string(),
        name: z.string().optional(),
        content: z.string().optional(),
        description: z.string().optional(),
        isTemplate: z.boolean().optional(),
        variables: z.array(z.string()).optional(),
        tags: z.array(z.string()).optional(),
      },
      async (params) => {
        try {
          const updatedPrompt = await storageAdapter.updatePrompt(params.id, {
            name: params.name,
            content: params.content,
            description: params.description,
            isTemplate: params.isTemplate,
            variables: params.variables,
            tags: params.tags,
          });
      
      return {
            type: "object",
            object: updatedPrompt,
          };
        } catch (error) {
          return {
            type: "error",
            error: `Error updating prompt: ${error.message}`,
          };
        }
      }
    );
    
  server.tool(
    "list_prompts",
    {
        isTemplate: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      },
      async (params) => {
        const prompts = await storageAdapter.listPrompts(params);
        
        return {
          type: "object",
          object: {
            prompts,
            total: prompts.length,
          },
        };
      }
    );
    
    server.tool(
      "delete_prompt",
      {
        id: z.string(),
      },
      async (params) => {
        try {
          await storageAdapter.deletePrompt(params.id);
          return {
            type: "object",
            object: { success: true },
          };
        } catch (error) {
      return {
            type: "error",
            error: `Error deleting prompt: ${error.message}`,
          };
        }
      }
    );
    
  server.tool(
    "apply_template",
    {
      id: z.string(),
        variables: z.record(z.string()),
      },
      async (params) => {
        try {
          const prompt = await storageAdapter.getPrompt(params.id);
      
      if (!prompt.isTemplate) {
        return {
              type: "error",
              error: `Prompt is not a template: ${params.id}`,
            };
          }
          
          const content = applyTemplate(prompt.content, params.variables);
      
      return {
            type: "object",
            object: {
              content,
              originalPrompt: prompt,
              appliedVariables: params.variables,
            },
          };
        } catch (error) {
          return {
            type: "error",
            error: `Error applying template: ${error.message}`,
          };
        }
      }
    );
    
    // Start HTTP server if enabled
    if (DEFAULT_CONFIG.httpServer) {
      startHttpServer(DEFAULT_CONFIG);
    }
    
    // Connect to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("MCP Prompts Server connected successfully to stdio transport");
  } catch (error) {
    console.error("Error starting server:", error);
  }
}

// Run the server
main().catch((error) => {
  console.error("Unhandled error:", error);
  process.exit(1);
});