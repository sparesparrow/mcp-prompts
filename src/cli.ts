#!/usr/bin/env node

/**
 * MCP Prompts CLI
 * Command-line interface for the MCP Prompts server
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
import { startServer } from './index.js';
import { getConfig } from './config.js';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { FileAdapter } from './adapters/file-adapter.js';
import { PromptService } from './services/prompt-service.js';
import { 
  AddPromptParams, 
  GetPromptParams, 
  ListPromptsParams,
  ToolResponse,
  McpRequestExtra
} from './core/types.js';

// Define version for use in CLI options
let packageVersion = '1.0.0';
try {
  const packageJsonPath = path.resolve(process.cwd(), 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageVersion = packageJson.version || packageVersion;
  }
} catch (error) {
  console.warn('Failed to read package.json version:', error);
}

// Process command line arguments
const args = process.argv.slice(2);
const showVersion = args.includes('--version') || args.includes('-v');
const showHelp = args.includes('--help') || args.includes('-h');
const httpMode = args.includes('--http');

/**
 * Display help information
 */
function displayHelp(): void {
  console.log(`
MCP Prompts Server v${packageVersion}
A server for managing prompts and templates using the Model Context Protocol

Usage:
  npx -y @sparesparrow/mcp-prompts [options]

Options:
  --version, -v  Show version
  --help, -h     Show this help message
  --http         Run as HTTP server instead of stdio mode

Environment Variables:
  SERVER_NAME        Server name (default: 'MCP Prompts Server')
  SERVER_VERSION     Server version (default: package.json version)
  STORAGE_TYPE       Storage type: 'file' or 'postgres' (default: 'file')
  PROMPTS_DIR        Directory for storing prompts (default: '~/mcp/data/prompts')
  BACKUPS_DIR        Directory for backups (default: '~/mcp/data/backups')
  PORT               Port for HTTP server (default: 3003)
  LOG_LEVEL          Logging level: 'debug', 'info', 'warn', 'error' (default: 'info')
  
  # PostgreSQL settings (required if STORAGE_TYPE=postgres)
  PG_HOST            PostgreSQL host (default: 'localhost')
  PG_PORT            PostgreSQL port (default: 5432)
  PG_DATABASE        PostgreSQL database name (default: 'mcp_prompts')
  PG_USER            PostgreSQL username (default: 'postgres')
  PG_PASSWORD        PostgreSQL password
  PG_SSL             Use SSL for PostgreSQL connection (default: false)
  `);
}

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  try {
    process.stderr.write('Starting MCP Prompts CLI...\n');
    const config = getConfig();
    
    // Use file adapter by default for CLI
    const promptsDir = typeof config === 'object' && 'storage' in config && config.storage?.promptsDir
      ? config.storage.promptsDir
      : (config as any).promptsDir || path.join(process.env.HOME || '~', 'mcp/data/prompts');
    
    process.stderr.write(`Using file storage adapter with directory: ${promptsDir}\n`);
    
    // Ensure the prompts directory exists
    await fs.ensureDir(promptsDir);
    const storage = new FileAdapter(promptsDir);
    
    // Connect to storage
    await storage.connect();
    
    // Initialize prompt service
    const promptService = new PromptService(storage);
    
    // Initialize MCP server
    const serverName = 'MCP Prompts CLI';
    const serverVersion = process.env.npm_package_version || '1.0.0';
    
    const server = new McpServer({
      name: serverName,
      version: serverVersion
    });
    
    // Register all tools
    process.stderr.write('Registering MCP tools...\n');
    
    // Add prompt tool
    server.tool('add_prompt', async (extra: any) => {
      try {
        const result = await promptService.addPrompt(extra.arguments);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in add_prompt: ${error}\n`);
        throw error;
      }
    });
    
    // Get prompt tool
    server.tool('get_prompt', async (extra: any) => {
      try {
        const result = await promptService.getPrompt(extra.arguments.id);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in get_prompt: ${error}\n`);
        throw error;
      }
    });
    
    // List prompts tool
    server.tool('list_prompts', async (extra: any) => {
      try {
        const result = await promptService.listPrompts(extra.arguments);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (error) {
        process.stderr.write(`Error in list_prompts: ${error}\n`);
        throw error;
      }
    });
    
    // Connect to stdio transport
    process.stderr.write('Connecting to stdio transport...\n');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write('MCP Prompts CLI connected successfully to stdio transport\n');
    
    // Setup graceful shutdown
    process.on('SIGINT', async () => {
      process.stderr.write('Received SIGINT, shutting down gracefully...\n');
      if (storage && typeof storage.disconnect === 'function') {
        await storage.disconnect();
      }
      process.stderr.write('Shutdown complete\n');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      process.stderr.write('Received SIGTERM, shutting down gracefully...\n');
      if (storage && typeof storage.disconnect === 'function') {
        await storage.disconnect();
      }
      process.stderr.write('Shutdown complete\n');
      process.exit(0);
    });
    
  } catch (error) {
    process.stderr.write(`Failed to start CLI: ${error}\n`);
    process.exit(1);
  }
}

// Run the CLI
main().catch(error => {
  process.stderr.write(`Fatal error in main(): ${error}\n`);
  process.exit(1);
}); 