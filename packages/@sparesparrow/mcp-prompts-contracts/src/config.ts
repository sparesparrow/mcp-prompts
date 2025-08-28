/**
 * Configuration types for MCP Prompts
 */

export interface StorageAdapter {
  type: 'file' | 'postgres' | 'memory';
  config: {
    // File storage configuration
    promptsDir?: string;
    watchMode?: boolean;
    
    // PostgreSQL storage configuration
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    username?: string;
    password?: string;
    ssl?: boolean;
    
    // Memory storage configuration (no specific config)
    
    // Common options
    maxConnections?: number;
    timeout?: number;
    retryAttempts?: number;
  };
}

export interface ServerConfig {
  /** Server name */
  name: string;
  
  /** Server version */
  version: string;
  
  /** Server description */
  description?: string;
  
  /** Port for HTTP server (if running in HTTP mode) */
  port?: number;
  
  /** Host for HTTP server (if running in HTTP mode) */
  host?: string;
  
  /** Transport type */
  transport?: 'stdio' | 'http' | 'sse';
  
  /** Storage adapter configuration */
  storage: StorageAdapter;
  
  /** Enable debug mode */
  debug?: boolean;
  
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  /** CORS settings for HTTP mode */
  cors?: {
    origin?: string | string[];
    credentials?: boolean;
  };
  
  /** Rate limiting settings */
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
  };
  
  /** Security settings */
  security?: {
    enableHelmet?: boolean;
    trustProxy?: boolean;
  };
}
