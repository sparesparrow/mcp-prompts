#!/usr/bin/env node
/**
 * MCP Prompts Server
 * A server for managing prompts using the Model Context Protocol
 * 
 * NOTE: The shebang line above is critical for npx usage.
 * DO NOT REMOVE as it allows the module to be executed directly when 
 * installed globally or run via npx -y @sparesparrow/mcp-prompt-manager
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { setupPromptTools } from './tools/prompt-tools.js';
import { setupDatabaseTools } from './tools/database-tools.js';
import { setupProjectOrchestratorTools } from './tools/project-orchestrator-tools.js';
import { getConfig } from './config.js';

// Load package info
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get package version from package.json
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let packageVersion = '1.0.0';
try {
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));
  packageVersion = packageJson.version;
} catch (error) {
  console.warn('Could not read package.json:', error instanceof Error ? error.message : String(error));
}

// Welcome message
console.log(`
+----------------------------------------------+
|     MCP Prompts Server - v${packageVersion}              |
|                                              |
|  A streamlined server for managing prompts   |
|  and templates with Model Context Protocol   |
+----------------------------------------------+
`);

/**
 * Main function to start the MCP Prompts server
 */
async function main() {
  try {
    // Get configuration
    const config = getConfig();
    
    // Create MCP server
    const server = new McpServer({
      name: 'mcp-prompts',
      version: packageVersion,
    });
    
    // Setup error handling
    server.server.onerror = (error) => {
      console.error('Server error:', error instanceof Error ? error.stack : String(error));
    };
    
    // Setup tools with proper error handling
    try {
      await setupPromptTools(server);
      console.log('Prompt tools initialized successfully');
    } catch (error) {
      console.error('Failed to initialize prompt tools:', error instanceof Error ? error.message : String(error));
    }
    
    try {
      await setupDatabaseTools(server);
      console.log('Database tools initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database tools:', error instanceof Error ? error.message : String(error));
      if (config.storage.type === 'postgres') {
        console.error('Make sure your PostgreSQL connection string is correct');
      }
    }
    
    try {
      await setupProjectOrchestratorTools(server);
      console.log('Project orchestrator tools initialized successfully');
    } catch (error) {
      console.error('Failed to initialize project orchestrator tools:', error instanceof Error ? error.message : String(error));
    }
    
    // Connect server to transport
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.log(`\nMCP Prompts server v${packageVersion} started`);
    console.log(`Server configuration:`);
    console.log(`- Storage Type: ${config.storage.type}`);
    console.log(`- Prompts Directory: ${config.storage.promptsDir}`);
    
    if (config.storage.type === 'postgres') {
      try {
        // Test database connection without exposing sensitive connection string
        const pgConnectionStringMasked = config.storage.pgConnectionString?.replace(/\/\/([^:]+:[^@]+@)/g, '//*****:*****@') || 'Not configured';
        console.log(`- PostgreSQL: ${pgConnectionStringMasked}`);
      } catch (error) {
        console.log(`- PostgreSQL: Configured but connection details hidden`);
      }
    }
    
    if (config.server.verbose) {
      console.log(`- Verbose logging: Enabled`);
    }
    
    console.log(`\nUse this MCP server with npx or as a library in your project`);
    console.log(`Documentation: https://github.com/sparesparrow/mcp-prompt-manager`);

    // Handle process termination gracefully
    const exitHandler = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down...`);
      try {
        await server.close();
        console.log('Server shut down successfully');
      } catch (error) {
        console.error('Error shutting down server:', error instanceof Error ? error.message : String(error));
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => exitHandler('SIGINT'));
    process.on('SIGTERM', () => exitHandler('SIGTERM'));
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error instanceof Error ? error.stack : String(error));
      exitHandler('uncaughtException').catch(() => process.exit(1));
    });
  } catch (error) {
    console.error('Failed to start server:', error instanceof Error ? error.stack : String(error));
    process.exit(1);
  }
}

// Start the server
main();
