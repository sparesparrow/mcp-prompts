#!/usr/bin/env node
/**
 * MCP Prompts Server
 * A server for managing prompts using the Model Context Protocol
 * 
 * Main entry point for the server
 */

// Redirect console logs to stderr to prevent breaking stdio protocol
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
console.log = (...args) => process.stderr.write(args.map(a => String(a)).join(' ') + '\n');
console.info = (...args) => process.stderr.write(args.map(a => String(a)).join(' ') + '\n');

// Add error handling for uncaught exceptions
process.on('uncaughtException', (err) => {
  process.stderr.write(`Uncaught exception: ${err.message}\n${err.stack}\n`);
});
  
process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(`Unhandled rejection at: ${promise}, reason: ${reason}\n`);
});

import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServerConfig } from './utils/config.js';
import { Config, getConfig } from './config.js';
import { PromptService } from './services/prompt-service.js';
import { FileAdapter } from './adapters/file-adapter.js';
import { PostgresAdapter } from './adapters/postgres-adapter.js';
import { StorageAdapter } from './core/types.js';
import { createHttpServer } from './utils/http-server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

// Get current directory when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start the MCP Prompts Server with the provided configuration
 * @param {ServerConfig | Config} config Server configuration
 */
export async function startServer(config: Config | ServerConfig): Promise<void> {
  process.stderr.write('Starting MCP Prompts Server v' + ('serverVersion' in config ? config.serverVersion : process.env.npm_package_version || 'development') + '\n');
  process.stderr.write(`Config: ${JSON.stringify({
    storageType: config.storageType,
    promptsDir: config.promptsDir,
    storagePath: 'storage' in config ? config.storage?.promptsDir : undefined
  })}\n`);
  
  // Initialize storage adapter based on configuration
  const storageType = 'storage' in config ? config.storage.type : config.storageType;
  process.stderr.write(`Storage type: ${storageType}\n`);
  
  // Initialize storage adapter based on type
  let storage: StorageAdapter;
  
  if (storageType === 'postgres') {
    // For PostgreSQL storage
    const pgConnectionString = 'storage' in config && config.storage.pgConnectionString 
      ? config.storage.pgConnectionString 
      : process.env.POSTGRES_CONNECTION_STRING || '';
    
    if (!pgConnectionString) {
      throw new Error('PostgreSQL connection string is required for postgres storage');
    }
    
    process.stderr.write('Using PostgreSQL storage adapter\n');
    storage = new PostgresAdapter(pgConnectionString);
  } else if (storageType === 'memory') {
    // TODO: Implement memory storage adapter
    throw new Error('Memory storage adapter not implemented yet');
  } else {
    // Default to file storage
    const promptsDir = 'storage' in config 
      ? config.storage.promptsDir
      : config.promptsDir;
    process.stderr.write(`Using file storage adapter with directory: ${promptsDir}\n`);
    
    // Ensure the prompts directory exists
    await fs.ensureDir(promptsDir);
    storage = new FileAdapter(promptsDir);
  }
  
  // Connect to the storage
  await storage.connect();
  
  // Initialize prompt service
  const promptService = new PromptService(storage);
  
  // Start the HTTP server for health checks if HTTP_SERVER is enabled
  let httpServer;
  if (process.env.HTTP_SERVER === 'true') {
    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;
    const host = process.env.HOST || '0.0.0.0';
    httpServer = createHttpServer(storage, storageType, { port, host });
    process.stderr.write(`HTTP server started on ${host}:${port}\n`);
  }
  
  // Create MCP server with improved error handling
  try {
    process.stderr.write('Initializing MCP server...\n');
    
    const serverName = 'serverName' in config ? config.serverName : 'MCP Prompts Server';
    const serverVersion = 'serverVersion' in config ? config.serverVersion : process.env.npm_package_version || '1.0.0';
    
    const server = new McpServer({
      name: serverName,
      version: serverVersion
    });
    
    // Set up tools
    process.stderr.write('Registering MCP tools...\n');
    
    // Register add_prompt tool
    server.tool('add_prompt', async (extra: any) => {
      try {
        const result = await promptService.addPrompt(extra.arguments);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in add_prompt: ${error}\n`);
        throw error;
      }
    });
    
    // Register get_prompt tool
    server.tool('get_prompt', async (extra: any) => {
      try {
        const result = await promptService.getPrompt(extra.arguments.id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in get_prompt: ${error}\n`);
        throw error;
      }
    });
    
    // Register update_prompt tool
    server.tool('update_prompt', async (extra: any) => {
      try {
        const result = await promptService.updatePrompt(extra.arguments.id, extra.arguments);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in update_prompt: ${error}\n`);
        throw error;
      }
    });
    
    // Register list_prompts tool
    server.tool('list_prompts', async (extra: any) => {
      try {
        const result = await promptService.listPrompts(extra.arguments);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in list_prompts: ${error}\n`);
        throw error;
      }
    });
    
    // Register delete_prompt tool
    server.tool('delete_prompt', async (extra: any) => {
      try {
        await promptService.deletePrompt(extra.arguments.id);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      } catch (error) {
        process.stderr.write(`Error in delete_prompt: ${error}\n`);
        throw error;
      }
    });
    
    // Register apply_template tool
    server.tool('apply_template', async (extra: any) => {
      try {
        const result = await promptService.applyTemplate(extra.arguments.id, extra.arguments.variables);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in apply_template: ${error}\n`);
        throw error;
      }
    });
    
    // Connect using StdioServerTransport
    process.stderr.write('Connecting to stdio transport...\n');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('MCP Prompts Server connected successfully to stdio transport\n');
    
  } catch (error) {
    process.stderr.write(`Error setting up MCP server: ${error}\n`);
    
    // Try basic fallback mode
    process.stderr.write('Falling back to basic mode...\n');
    
    // Define serverName and serverVersion for fallback mode
    const fallbackServerName = 'serverName' in config ? config.serverName : 'MCP Prompts Server';
    const fallbackServerVersion = 'serverVersion' in config ? config.serverVersion : process.env.npm_package_version || '1.0.0';
    
    // Set up a basic stdin/stdout handler for JSON-RPC requests in fallback mode
    process.stdin.on('data', async (buffer) => {
      const input = buffer.toString().trim();
      if (!input) return;
      
      let parsedRequest: any = null;
      
      try {
        const request = JSON.parse(input);
        parsedRequest = request; // Store for use in catch block
        process.stderr.write(`Received request: ${JSON.stringify(request)}\n`);
        
        // Handle tools/call requests
        if (request.method === 'tools/call') {
          const { name, arguments: args } = request.params;
          let result;
          
          // Handle different tools
          if (name === 'list_prompts') {
            result = await promptService.listPrompts(args);
          } else if (name === 'get_prompt') {
            result = await promptService.getPrompt(args.id);
          } else if (name === 'add_prompt') {
            result = await promptService.addPrompt(args);
          } else if (name === 'update_prompt') {
            result = await promptService.updatePrompt(args.id, args);
          } else if (name === 'delete_prompt') {
            result = await promptService.deletePrompt(args.id);
          } else {
            throw new Error(`Unknown tool: ${name}`);
          }
          
          // Send response
          const response = {
            jsonrpc: '2.0',
            id: request.id,
            result: { result }
          };
          
          process.stdout.write(JSON.stringify(response) + '\n');
        }
        // Handle prompts/get requests
        else if (request.method === 'prompts/get') {
          const { name, arguments: args } = request.params;
          const prompt = await promptService.getPrompt(name);
          
          // Send response
          const response = {
            jsonrpc: '2.0',
            id: request.id,
            result: prompt
          };
          
          process.stdout.write(JSON.stringify(response) + '\n');
        }
        else if (request.method === 'initialize') {
          // Respond with server info
          const response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
                resources: {}
              },
              serverInfo: {
                name: fallbackServerName,
                version: fallbackServerVersion
              }
            }
          };
          process.stdout.write(JSON.stringify(response) + '\n');
        }
        else {
          // Unknown method
          const response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
            }
          };
          
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (error: unknown) {
        // Error handling
        process.stderr.write(`Error handling request: ${error}\n`);
        const response = {
          jsonrpc: '2.0',
          id: parsedRequest?.id || null,
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        };
        
        process.stdout.write(JSON.stringify(response) + '\n');
      }
    });
    
    process.stderr.write('Server running in fallback mode\n');
  }
  
  // Setup graceful shutdown
  process.on('SIGINT', async () => {
    process.stderr.write('Received SIGINT, shutting down gracefully...\n');
    await shutdown(storage, httpServer);
  });
  
  process.on('SIGTERM', async () => {
    process.stderr.write('Received SIGTERM, shutting down gracefully...\n');
    await shutdown(storage, httpServer);
  });
}

/**
 * Gracefully shut down the server
 * @param {StorageAdapter} storage Storage adapter instance
 * @param {http.Server} httpServer HTTP server instance (optional)
 */
async function shutdown(storage: any, httpServer?: any): Promise<void> {
  try {
    // Disconnect from storage
    if (storage && typeof storage.disconnect === 'function') {
      process.stderr.write('Disconnecting from storage...\n');
      await storage.disconnect();
    }
    
    // Shutdown HTTP server if running
    if (httpServer) {
      process.stderr.write('Shutting down HTTP server...\n');
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err: Error) => {
          if (err) {
            process.stderr.write(`Error shutting down HTTP server: ${err}\n`);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    
    process.stderr.write('Shutdown complete\n');
    process.exit(0);
  } catch (error) {
    process.stderr.write(`Error during shutdown: ${error}\n`);
    process.exit(1);
  }
}

// Start the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = getConfig();
  startServer(config).catch(error => {
    process.stderr.write(`Failed to start server: ${error}\n`);
    process.exit(1);
  });
}
