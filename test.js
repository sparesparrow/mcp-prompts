#!/usr/bin/env node

const { version, config } = require('@sparesparrow/mcp-prompts');

console.log('MCP Prompts Version:', version);
console.log('Config loaded successfully:', !!config);
console.log('Config object:', JSON.stringify(config, null, 2));

// Try to access some methods to ensure they're available
const { createPromptManager } = require('@sparesparrow/mcp-prompts');

try {
  const manager = createPromptManager();
  console.log('Prompt manager created successfully');
} catch (error) {
  console.error('Error creating prompt manager:', error.message);
} 