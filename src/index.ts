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

// Try to import MCP packages, but make them optional for testing
let Server, StdioServerTransport, HttpServerTransport;
try {
  const mcpServerModule = await import("@modelcontextprotocol/sdk/server/index.js");
  const mcpStdioModule = await import("@modelcontextprotocol/sdk/server/stdio.js");
  
  Server = mcpServerModule.Server;
  StdioServerTransport = mcpStdioModule.StdioServerTransport;
  
  // Try to import the HTTP server transport separately, as it might be missing
  try {
    const mcpHttpModule = await import("@modelcontextprotocol/sdk/server/http.js");
    HttpServerTransport = mcpHttpModule.HttpServerTransport;
  } catch (error) {
    console.warn("HTTP server transport not available. HTTP mode will not work.");
  }
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
export async function startServer(config: ServerConfig | Config): Promise<void> {
  console.log(`Starting MCP Prompts Server v${process.env.npm_package_version || 'development'}`);
  
  // Determine storage type from either config format
  const storageType = 'storage' in config ? config.storage.type : config.storageType;
  console.log(`Storage type: ${storageType}`);
  
  // Determine prompts directory from either config format
  const promptsDir = 'storage' in config 
    ? config.storage.promptsDir
    : config.promptsDir;
  console.log(`Prompts directory: ${promptsDir}`);
  
  // Ensure the prompts directory exists
  await fs.ensureDir(promptsDir);
  
  // Initialize storage adapter
  const storage = new FileAdapter(promptsDir);
  await storage.connect();
  
  // Initialize prompt service
  const promptService = new PromptService(storage);
  
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
    
    // Set up resource and tool handlers
    // TODO: Implement resource and tool handlers
    
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
                version: '1.0.0',
                vendor: 'sparesparrow',
              },
              capabilities: {
                functions: ['echo'],
              },
            },
          };
          process.stdout.write(JSON.stringify(response) + '\n');
        }
        // Handle echo function
        else if (message.method === 'function' && message.params?.name === 'echo') {
          // Echo back the text
          const response = {
            id: message.id,
            result: {
              value: {
                result: message.params.arguments.text,
              },
            },
          };
          process.stdout.write(JSON.stringify(response) + '\n');
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
}

// Start the server if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = getConfig();
  startServer(config).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
