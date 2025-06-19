import * as path from 'path';
import { ServerConfig } from './interfaces.js';

/**
 * Loads the server configuration from environment variables and provides default values.
 */
export function loadConfig(): ServerConfig {
  return {
    name: process.env.SERVER_NAME || 'mcp-prompts',
    version: process.env.npm_package_version || '0.0.0',
    storageType: (process.env.STORAGE_TYPE as 'file' | 'postgres' | 'memory') || 'file',
    promptsDir: process.env.PROMPTS_DIR || path.join(process.cwd(), 'data/prompts'),
    backupsDir: process.env.BACKUPS_DIR || path.join(process.cwd(), 'data/backups'),
    port: Number(process.env.PORT) || 3003,
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    httpServer: process.env.HTTP_SERVER === 'true',
    host: process.env.HOST || '0.0.0.0',
    enableSSE: process.env.ENABLE_SSE === 'true',
    ssePath: process.env.SSE_PATH || '/events',
    corsOrigin: process.env.CORS_ORIGIN || '*',
    postgres: process.env.POSTGRES_CONNECTION_STRING
      ? {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: Number(process.env.POSTGRES_PORT) || 5432,
          database: process.env.POSTGRES_DATABASE || 'mcp_prompts',
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || 'postgres',
          ssl: process.env.POSTGRES_SSL === 'true',
          connectionString: process.env.POSTGRES_CONNECTION_STRING,
        }
      : {
          host: process.env.POSTGRES_HOST || 'localhost',
          port: Number(process.env.POSTGRES_PORT) || 5432,
          database: process.env.POSTGRES_DATABASE || 'mcp_prompts',
          user: process.env.POSTGRES_USER || 'postgres',
          password: process.env.POSTGRES_PASSWORD || 'postgres',
          ssl: process.env.POSTGRES_SSL === 'true',
        },
  };
} 