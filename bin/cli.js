#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Parse command line arguments
const args = process.argv.slice(2);
const helpRequested = args.includes('--help') || args.includes('-h');
const versionRequested = args.includes('--version') || args.includes('-v');
const debugMode = args.includes('--debug') || args.includes('-d');
const portArg = args.find(arg => /^--port=\d+$/.test(arg));
const port = portArg ? portArg.split('=')[1] : null;

// Get package info
const packagePath = path.join(__dirname, '..', 'package.json');
const packageInfo = JSON.parse(fs.readFileSync(packagePath, 'utf8'));

// Display help
if (helpRequested) {
  console.log(`
MCP Prompts Server v${packageInfo.version}

A server for managing, storing, and providing prompts and prompt templates for LLM interactions.

Usage:
  mcp-prompts [options]

Options:
  -h, --help              Show this help message
  -v, --version           Show version information
  -d, --debug             Run in debug mode with verbose logging
  --port=<port>           Specify a custom port for HTTP server (if enabled)

Examples:
  mcp-prompts
  mcp-prompts --debug
  mcp-prompts --port=3000

Documentation:
  See https://github.com/yourusername/mcp-prompts for more information.
  `);
  process.exit(0);
}

// Display version
if (versionRequested) {
  console.log(`MCP Prompts Server v${packageInfo.version}`);
  process.exit(0);
}

// Set up environment
const env = { ...process.env };

if (debugMode) {
  env.DEBUG = 'true';
  console.log('Starting MCP Prompts Server in debug mode...');
}

if (port) {
  env.PORT = port;
  console.log(`Using custom port: ${port}`);
}

// Path to the main server script
const serverPath = path.join(__dirname, '..', 'build', 'index.js');

// Check if the server has been built
if (!fs.existsSync(serverPath)) {
  console.error('Error: Server has not been built. Run "npm run build" first.');
  process.exit(1);
}

// Start the server
const server = spawn(process.execPath, [serverPath], {
  env,
  stdio: 'inherit'
});

// Handle process events
server.on('error', (err) => {
  console.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  server.kill('SIGTERM');
}); 