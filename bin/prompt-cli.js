#!/usr/bin/env node

/**
 * JavaScript bridge for prompt-cli
 * This file ensures the CLI works correctly when installed globally
 */

// Check if running in development or production
const isDevMode = process.env.NODE_ENV === 'development';

if (isDevMode) {
  // In development, use ts-node to run the TypeScript directly
  require('ts-node').register();
  require('./prompt-cli.ts');
} else {
  // In production, run the compiled JavaScript
  require('../build/bin/prompt-cli.js');
} 