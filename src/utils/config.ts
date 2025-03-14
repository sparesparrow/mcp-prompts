/**
 * Configuration utilities for MCP Prompts Server
 * Handles loading and validating configuration from environment variables
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current directory when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the configuration type
export interface ServerConfig {
  port: number;
  storageType: 'file' | 'postgres';
  promptsDir: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
  };
  // Add other configuration options as needed
}

/**
 * Load configuration from environment variables with reasonable defaults
 */
export function getConfig(): ServerConfig {
  // Load environment variables if .env file exists
  try {
    const dotenvPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(dotenvPath)) {
      // Use require for dotenv as it's a CommonJS module
      const dotenv = require('dotenv');
      dotenv.config({ path: dotenvPath });
    }
  } catch (error) {
    console.warn('Could not load .env file:', error);
  }

  // Define the configuration object with defaults
  const config: ServerConfig = {
    port: parseInt(process.env.PORT || '3003', 10),
    storageType: (process.env.STORAGE_TYPE || 'file') as 'file' | 'postgres',
    promptsDir: process.env.PROMPTS_DIR || path.resolve(process.cwd(), 'data', 'prompts'),
    logLevel: (process.env.LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error',
  };

  // Create the prompts directory if it doesn't exist
  try {
    if (!fs.existsSync(config.promptsDir)) {
      fs.mkdirSync(config.promptsDir, { recursive: true });
      console.log(`Created prompts directory: ${config.promptsDir}`);
    }
  } catch (error) {
    console.warn(`Could not create prompts directory: ${config.promptsDir}`, error);
  }

  // Add Postgres configuration if storage type is postgres
  if (config.storageType === 'postgres') {
    config.postgres = {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || 'mcp_prompts',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASSWORD || '',
      ssl: process.env.PG_SSL === 'true',
    };
  }

  return config;
} 