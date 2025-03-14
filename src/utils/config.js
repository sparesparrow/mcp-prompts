/**
 * Configuration utilities for the MCP Prompts Server
 */

import path from 'path';
import fs from 'fs-extra';
import { fileURLToPath } from 'url';

// Get current directory when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * @typedef {Object} PostgresConfig
 * @property {string} host - PostgreSQL host
 * @property {number} port - PostgreSQL port
 * @property {string} database - PostgreSQL database name
 * @property {string} user - PostgreSQL username
 * @property {string} password - PostgreSQL password
 */

/**
 * @typedef {Object} ServerConfig
 * @property {string} serverName - Name of the server
 * @property {string} serverVersion - Version of the server
 * @property {string} storageType - Type of storage ('file' or 'postgres')
 * @property {string} promptsDir - Directory to store prompts (for file storage)
 * @property {PostgresConfig} [pgConfig] - PostgreSQL configuration (for postgres storage)
 * @property {Object} [storage] - Storage configuration
 */

/**
 * Load configuration from environment variables
 * @returns {ServerConfig} Server configuration
 */
export function loadConfig() {
  // Get package version
  const packageJsonPath = path.resolve(__dirname, '../../package.json');
  const packageJson = fs.readJsonSync(packageJsonPath);
  const version = packageJson.version || '0.0.0';
  
  // Default configuration
  const config = {
    serverName: process.env.SERVER_NAME || 'MCP Prompts Server',
    serverVersion: version,
    storageType: process.env.STORAGE_TYPE || 'file',
    promptsDir: process.env.PROMPTS_DIR || path.resolve(process.cwd(), 'prompts'),
    storage: {
      type: process.env.STORAGE_TYPE || 'file',
      path: process.env.PROMPTS_DIR || path.resolve(process.cwd(), 'prompts')
    }
  };
  
  // Add PostgreSQL configuration if needed
  if (config.storageType === 'postgres') {
    config.pgConfig = {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'mcp_prompts',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres'
    };
    
    config.storage = {
      type: 'postgres',
      ...config.pgConfig
    };
  }
  
  return config;
}

/**
 * Validate configuration
 * @param {ServerConfig} config - Server configuration
 * @throws {Error} If configuration is invalid
 */
export function validateConfig(config) {
  if (!config.serverName) {
    throw new Error('Server name is required');
  }
  
  if (!config.serverVersion) {
    throw new Error('Server version is required');
  }
  
  if (!config.storageType) {
    throw new Error('Storage type is required');
  }
  
  if (config.storageType !== 'file' && config.storageType !== 'postgres') {
    throw new Error(`Unsupported storage type: ${config.storageType}`);
  }
  
  if (config.storageType === 'file' && !config.promptsDir) {
    throw new Error('Prompts directory is required for file storage');
  }
  
  if (config.storageType === 'postgres' && !config.pgConfig) {
    throw new Error('PostgreSQL configuration is required for postgres storage');
  }
}

export default { loadConfig, validateConfig }; 