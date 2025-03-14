/**
 * Configuration utilities for MCP Prompts Server
 * Handles loading and validating configuration from environment variables
 */

import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Load environment variables from .env file
dotenv.config();

// Get current directory when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get user home directory
const userHomeDir = os.homedir();

/**
 * Configuration for the MCP Prompts Server
 */
export interface Config {
  /** Server name */
  serverName: string;
  
  /** Server version */
  serverVersion: string;
  
  /** Storage type ('file' or 'postgres') */
  storageType: 'file' | 'postgres' | 'memory';
  
  /** Directory to store prompts (for file storage) */
  promptsDir: string;
  
  /** Storage configuration */
  storage: {
    /** Storage type ('file' or 'postgres') */
    type: 'file' | 'postgres' | 'memory';
    
    /** Directory to store prompts (for file storage) */
    promptsDir: string;
    
    /** Directory to store backups (for file storage) */
    backupsDir?: string;
    
    /** PostgreSQL connection string (for postgres storage) */
    pgConnectionString?: string;
  };
}

/**
 * Get the server configuration
 * @returns Server configuration
 */
export function getConfig(): Config {
  // Get package version
  const packageJsonPath = path.resolve(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version || '0.0.0';
  
  // Default configuration
  const config: Config = {
    serverName: process.env.SERVER_NAME || 'MCP Prompts Server',
    serverVersion: version,
    storageType: (process.env.STORAGE_TYPE as 'file' | 'postgres' | 'memory') || 'file',
    promptsDir: process.env.PROMPTS_DIR || path.join(userHomeDir, 'mcp', 'data', 'prompts'),
    storage: {
      type: (process.env.STORAGE_TYPE as 'file' | 'postgres' | 'memory') || 'file',
      promptsDir: process.env.PROMPTS_DIR || path.join(userHomeDir, 'mcp', 'data', 'prompts'),
      backupsDir: process.env.BACKUPS_DIR || path.join(userHomeDir, 'mcp', 'data', 'backups'),
    }
  };
  
  // Add PostgreSQL configuration if needed
  if (config.storageType === 'postgres') {
    config.storage.pgConnectionString = process.env.POSTGRES_CONNECTION_STRING || 
      `postgresql://${process.env.POSTGRES_USER || 'postgres'}:${process.env.POSTGRES_PASSWORD || 'postgres'}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'mcp_prompts'}`;
  }
  
  return config;
}

/**
 * Validate the server configuration
 * @param config Server configuration
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: Config): void {
  if (!config.serverName) {
    throw new Error('Server name is required');
  }
  
  if (!config.serverVersion) {
    throw new Error('Server version is required');
  }
  
  if (!config.storageType) {
    throw new Error('Storage type is required');
  }
  
  if (config.storageType !== 'file' && config.storageType !== 'postgres' && config.storageType !== 'memory') {
    throw new Error(`Unsupported storage type: ${config.storageType}`);
  }
  
  if (config.storageType === 'file' && !config.promptsDir) {
    throw new Error('Prompts directory is required for file storage');
  }
  
  if (config.storageType === 'postgres' && !config.storage.pgConnectionString) {
    throw new Error('PostgreSQL connection string is required for postgres storage');
  }
} 