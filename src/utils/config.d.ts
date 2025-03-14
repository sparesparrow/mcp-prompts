/**
 * TypeScript definitions for the config module
 */

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface ServerConfig {
  serverName: string;
  serverVersion: string;
  storageType: 'file' | 'postgres';
  promptsDir: string;
  pgConfig?: PostgresConfig;
  storage?: {
    type: string;
    path?: string;
    [key: string]: any;
  };
}

export function loadConfig(): ServerConfig;
export function validateConfig(config: ServerConfig): void;

declare const _default: {
  loadConfig: typeof loadConfig;
  validateConfig: typeof validateConfig;
};

export default _default; 