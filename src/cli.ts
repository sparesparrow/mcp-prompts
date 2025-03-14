#!/usr/bin/env node

/**
 * MCP Prompts CLI
 * Command-line interface for the MCP Prompts server
 */

import fs from 'fs-extra';
import path from 'path';
import { startServer } from './index.js';
import { getConfig } from './config.js';

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
    // Show version if requested
    if (showVersion) {
      console.log(`MCP Prompts Server v${packageVersion}`);
      return;
    }
    
    // Show help if requested
    if (showHelp) {
      displayHelp();
      return;
    }
    
    // Set HTTP_SERVER environment variable based on --http flag
    if (httpMode) {
      process.env.HTTP_SERVER = 'true';
    }
    
    // Load configuration and start server
    const config = getConfig();
    await startServer(config);
  } catch (error) {
    console.error('Error starting MCP Prompts Server:', error);
    process.exit(1);
  }
}

// Run the CLI
main().catch(error => {
  console.error('Error in MCP Prompts CLI:', error);
  process.exit(1);
}); 