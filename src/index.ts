#!/usr/bin/env node
/**
 * MCP Prompts Server
 * A server for managing prompts using the Model Context Protocol
 * 
 * Main entry point for the server
 */

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

// Try to import MCP packages, but make them optional for testing
let Server, StdioServerTransport, HttpServerTransport;
try {
  const mcpServerModule = await import("@modelcontextprotocol/sdk/server/index.js");
  const mcpStdioModule = await import("@modelcontextprotocol/sdk/server/stdio.js");
  
  Server = mcpServerModule.Server;
  StdioServerTransport = mcpStdioModule.StdioServerTransport;
  
  // HTTP transport isn't currently available in the SDK
  // This will be skipped and handled by the conditional checks later
  console.warn("HTTP transport currently not available in the SDK. Falling back to stdio mode.");
  HttpServerTransport = null;
} catch (error) {
  console.warn("MCP SDK packages not available. Running in limited mode.");
}

// Get current directory when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Start the MCP Prompts Server with the provided configuration
 * @param {ServerConfig | Config} config Server configuration
 */
export async function startServer(config: Config | ServerConfig): Promise<void> {
  console.log('Starting MCP Prompts Server v' + ('serverVersion' in config ? config.serverVersion : process.env.npm_package_version || 'development'));
  console.log('Config:', {
    storageType: config.storageType,
    promptsDir: config.promptsDir,
    storagePath: 'storage' in config ? config.storage?.promptsDir : undefined
  });
  
  // Initialize storage adapter based on configuration
  const storageType = 'storage' in config ? config.storage.type : config.storageType;
  console.log('Storage type:', storageType);
  
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
    
    console.log('Using PostgreSQL storage adapter');
    storage = new PostgresAdapter(pgConnectionString);
  } else if (storageType === 'memory') {
    // TODO: Implement memory storage adapter
    throw new Error('Memory storage adapter not implemented yet');
  } else {
    // Default to file storage
    const promptsDir = 'storage' in config 
      ? config.storage.promptsDir
      : config.promptsDir;
    console.log(`Using file storage adapter with directory: ${promptsDir}`);
    
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
    console.log(`HTTP server started on ${host}:${port}`);
  }
  
  // If MCP SDK is available, set up the full server
  if (Server && (StdioServerTransport || HttpServerTransport)) {
    const serverName = 'serverName' in config ? config.serverName : 'MCP Prompts Server';
    const serverVersion = 'serverVersion' in config ? config.serverVersion : '1.0.0';
    
    const server = new Server({
      name: serverName,
      version: serverVersion
    }, {
      capabilities: {
        resources: {},
        tools: {}
      }
    });
    
    // Check if server has the registerTool method
    if (typeof server.registerTool !== 'function') {
      console.error('server.registerTool is not a function. Using fallback mode.');
      console.log('Server running in fallback mode');
      
      // Fallback to basic mode - check if StdioServerTransport is available and has listen method
      if (StdioServerTransport && typeof StdioServerTransport.prototype.listen === 'function') {
        const transport = new StdioServerTransport();
        transport.listen((message: any) => {
          return handleFunction(message, promptService);
        });
      } else {
        console.log('Running in minimal fallback mode');
        // Create a minimal HTTP server for basic functionality
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;
        const host = process.env.HOST || '0.0.0.0';
        const httpServer = createHttpServer(storage, storageType, { port, host });
        console.log(`Minimal HTTP server started on ${host}:${port}`);
      }
      
      // Handle shutdown
      process.on('SIGINT', async () => {
        await shutdown(storage, httpServer);
      });
      process.on('SIGTERM', async () => {
        await shutdown(storage, httpServer);
      });
      
      return; // Exit from the function early
    }
    
    // Set up resource and tool handlers
    try {
      // Register tools for prompt management
      server.registerTool('add_prompt', async (params: any) => {
        try {
          const result = await promptService.addPrompt(params);
          return { result };
        } catch (error) {
          console.error('Error in add_prompt:', error);
          throw error;
        }
      });
      
      server.registerTool('get_prompt', async (params) => {
        try {
          const result = await promptService.getPrompt(params.id);
          return { result };
        } catch (error) {
          console.error('Error in get_prompt:', error);
          throw error;
        }
      });
      
      server.registerTool('update_prompt', async (params) => {
        try {
          const result = await promptService.updatePrompt(params.id, params);
          return { result };
        } catch (error) {
          console.error('Error in update_prompt:', error);
          throw error;
        }
      });
      
      server.registerTool('list_prompts', async (params) => {
        try {
          const result = await promptService.listPrompts(params);
          return { result };
        } catch (error) {
          console.error('Error in list_prompts:', error);
          throw error;
        }
      });
      
      server.registerTool('delete_prompt', async (params) => {
        try {
          await promptService.deletePrompt(params.id);
          return { result: { success: true } };
        } catch (error) {
          console.error('Error in delete_prompt:', error);
          throw error;
        }
      });
      
      server.registerTool('apply_template', async (params) => {
        try {
          const result = await promptService.applyTemplate(params.id, params.variables);
          return { result };
        } catch (error) {
          console.error('Error in apply_template:', error);
          throw error;
        }
      });
      
      // Simple stdio handler for MCP Inspector
      if (process.env.HTTP_SERVER !== 'true') {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.log('MCP Prompts Server running in stdio mode');
      } else if (HttpServerTransport) {
        const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3003;
        const transport = new HttpServerTransport({ port });
        await server.connect(transport);
        console.log(`MCP Prompts Server running in HTTP mode on port ${port}`);
      } else {
        console.error('HTTP server transport not available');
        process.exit(1);
      }
    } catch (error) {
      console.warn('Error setting up MCP server:', error);
      
      // Set up a basic stdin/stdout handler for JSON-RPC requests in fallback mode
      console.warn("server.registerTool is not a function. Using fallback mode.");
      console.log("Server running in fallback mode");
      
      // Set up a basic stdin/stdout handler for JSON-RPC requests in fallback mode
      process.stdin.on('data', async (buffer) => {
        const input = buffer.toString().trim();
        if (!input) return;
        
        let parsedRequest: any = null;
        
        try {
          const request = JSON.parse(input);
          parsedRequest = request; // Store for use in catch block
          console.log(`Received request: ${JSON.stringify(request)}`);
          
          // Handle tools/call requests
          if (request.method === 'tools/call') {
            const { name, arguments: args } = request.params;
            let result;
            
            // Handle different tools
            if (name === 'list_prompts') {
              result = await promptService.listPrompts(args);
            } else if (name === 'get_prompt') {
              result = await promptService.getPrompt(args);
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
            
            console.log(JSON.stringify(response));
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
            
            console.log(JSON.stringify(response));
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
            
            console.log(JSON.stringify(response));
          }
        } catch (error: unknown) {
          // Error handling
          const response = {
            jsonrpc: '2.0',
            id: parsedRequest?.id || null,
            error: {
              code: -32000,
              message: error instanceof Error ? error.message : 'Unknown error'
            }
          };
          
          console.log(JSON.stringify(response));
        }
      });
    }
  } else {
    // Simple stdio handler for MCP Inspector when SDK is not available
    console.log('Running in minimal mode without MCP SDK');
    
    process.stdin.setEncoding('utf8');
    
    // Handle incoming messages
    process.stdin.on('data', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle initialization
        if (message.method === 'initialize') {
          // Respond with server info
          const response = {
            id: message.id,
            result: {
              server: {
                name: 'MCP Prompts Server',
                version: process.env.npm_package_version || '1.0.0',
                vendor: 'sparesparrow',
              },
              capabilities: {
                functions: ['add_prompt', 'get_prompt', 'update_prompt', 'list_prompts', 'delete_prompt', 'apply_template'],
              },
            },
          };
          process.stdout.write(JSON.stringify(response) + '\n');
        }
        // Handle function calls
        else if (message.method === 'function' && message.params?.name) {
          handleFunction(message, promptService);
        }
        // Handle unknown methods
        else if (message.id) {
          // Respond with error for unknown methods
          const response = {
            id: message.id,
            error: {
              code: -32601,
              message: 'Method not found',
            },
          };
          process.stdout.write(JSON.stringify(response) + '\n');
        }
      } catch (error) {
        console.error('Error processing message:', error);
        // Send error response if we have an ID
        try {
          const message = JSON.parse(data.toString());
          if (message.id) {
            const response = {
              id: message.id,
              error: {
                code: -32603,
                message: 'Internal error',
              },
            };
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        } catch (e) {
          // Ignore parse errors in error handler
        }
      }
    });
    
    console.log('MCP Prompts Server running in stdio mode for MCP Inspector');
  }
  
  // Setup graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Received SIGINT, shutting down gracefully...');
    await shutdown(storage, httpServer);
  });
  
  process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    await shutdown(storage, httpServer);
  });
}

/**
 * Handle MCP function calls in minimal mode
 * @param {any} message MCP message
 * @param {PromptService} promptService Prompt service instance
 */
async function handleFunction(message: any, promptService: PromptService): Promise<void> {
  const { id, params } = message;
  const { name, arguments: args } = params;
  
  try {
    let result;
    
    switch (name) {
      case 'add_prompt':
        result = await promptService.addPrompt(args);
        break;
      case 'get_prompt':
        result = await promptService.getPrompt(args.id);
        break;
      case 'update_prompt':
        result = await promptService.updatePrompt(args.id, args);
        break;
      case 'list_prompts':
        result = await promptService.listPrompts(args);
        break;
      case 'delete_prompt':
        await promptService.deletePrompt(args.id);
        result = { success: true };
        break;
      case 'apply_template':
        result = await promptService.applyTemplate(args.id, args.variables);
        break;
      default:
        throw new Error(`Unknown function: ${name}`);
    }
    
    const response = {
      id,
      result: {
        value: {
          result,
        },
      },
    };
    
    process.stdout.write(JSON.stringify(response) + '\n');
  } catch (error) {
    console.error(`Error handling function ${name}:`, error);
    
    const response = {
      id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
    
    process.stdout.write(JSON.stringify(response) + '\n');
  }
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
      console.log('Disconnecting from storage...');
      await storage.disconnect();
    }
    
    // Shutdown HTTP server if running
    if (httpServer) {
      console.log('Shutting down HTTP server...');
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err: Error) => {
          if (err) {
            console.error('Error shutting down HTTP server:', err);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
    
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = getConfig();
  startServer(config).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
