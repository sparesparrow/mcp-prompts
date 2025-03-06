/**
 * Configuration interfaces for MCP Prompts Server
 */

export interface Config {
  server: ServerConfig;
  storage: StorageConfig;
}

export interface ServerConfig {
  port: number;
  host: string;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export type StorageConfig = FileStorageConfig | PgAIStorageConfig;

export interface FileStorageConfig {
  type: 'file';
  options: {
    baseDir: string;
  };
}

export interface PgAIStorageConfig {
  type: 'pgai';
  options: {
    connectionString: string;
    poolSize?: number;
    sslMode?: boolean;
  };
}

export const defaultConfig: Config = {
  server: {
    port: 3000,
    host: 'localhost',
    logLevel: 'info'
  },
  storage: {
    type: 'file',
    options: {
      baseDir: './prompts'
    }
  }
};

/**
 * Creates a configuration with default values merged with provided values
 */
export function createConfig(config: Partial<Config> = {}): Config {
  return {
    server: {
      ...defaultConfig.server,
      ...config.server
    },
    storage: config.storage || defaultConfig.storage
  };
} 