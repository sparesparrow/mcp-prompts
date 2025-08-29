#!/usr/bin/env node

const { spawn } = require('child_process');

// Start the MCP server
const mcpServer = spawn('node', ['dist/index.js'], {
  env: { ...process.env, MODE: 'mcp' },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Test initialization
const initMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  }
};

console.log('Sending initialization message...');
mcpServer.stdin.write(JSON.stringify(initMessage) + '\n');

// Handle responses
mcpServer.stdout.on('data', (data) => {
  console.log('Received:', data.toString());
});

mcpServer.stderr.on('data', (data) => {
  console.error('Error:', data.toString());
});

// Cleanup after 5 seconds
setTimeout(() => {
  console.log('Test completed');
  mcpServer.kill();
  process.exit(0);
}, 5000);
