import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Configuration interface for the MCP Prompts server
 */
export interface Config {
  /** Storage settings */
  storage: {
    /** Storage type (file, memory, postgres) */
    type: 'file' | 'memory' | 'postgres';
    /** Directory for file-based storage */
    promptsDir: string;
    /** PostgreSQL connection string for postgres storage */
    pgConnectionString?: string;
  };
  /** Server settings */
  server: {
    /** Server name for MCP protocol */
    name: string;
    /** Server version */
    version: string;
    /** Logging level */
    logLevel: 'info' | 'debug' | 'error';
  };
}

/**
 * Default configuration values
 */
const defaultConfig: Config = {
  storage: {
    type: 'file',
    promptsDir: './prompts',
    pgConnectionString: undefined,
  },
  server: {
    name: 'mcp-prompts',
    version: '1.0.0',
    logLevel: 'info',
  }
};

/**
 * Get the configuration with environment variables and overrides
 * @param overrides Optional configuration overrides
 * @returns Merged configuration
 */
export function getConfig(overrides: Partial<Config> = {}): Config {
  // Apply environment variables
  const envConfig: Partial<Config> = {
    storage: {
      type: (process.env.STORAGE_TYPE as 'file' | 'memory' | 'postgres') || defaultConfig.storage.type,
      promptsDir: process.env.PROMPTS_DIR || defaultConfig.storage.promptsDir,
      pgConnectionString: process.env.PG_CONNECTION_STRING || defaultConfig.storage.pgConnectionString,
    },
    server: {
      name: process.env.SERVER_NAME || defaultConfig.server.name,
      version: process.env.SERVER_VERSION || defaultConfig.server.version,
      logLevel: (process.env.LOG_LEVEL as 'info' | 'debug' | 'error') || defaultConfig.server.logLevel,
    }
  };

  // Merge default, environment, and override configs
  return {
    ...defaultConfig,
    ...envConfig,
    ...overrides,
    storage: {
      ...defaultConfig.storage,
      ...envConfig.storage,
      ...(overrides.storage || {}),
    },
    server: {
      ...defaultConfig.server,
      ...envConfig.server,
      ...(overrides.server || {}),
    },
  };
}

/**
 * Validate the configuration
 * @param config Configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: Config): void {
  // Validate storage configuration
  if (config.storage.type === 'file' && !config.storage.promptsDir) {
    throw new Error('Storage directory is required for file storage');
  }
  
  if (config.storage.type === 'postgres' && !config.storage.pgConnectionString) {
    throw new Error('PostgreSQL connection string is required for postgres storage');
  }
} 