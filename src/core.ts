/**
 * Core functionality for MCP Prompts Server
 * This file re-exports from the core modules
 */

// Re-export types from core/types
export type { Prompt, PromptStorage, ListPromptOptions } from './core/types';

// Re-export from config
export type { Config } from './core/config';

// Re-export storage providers
export {
  createStorageProvider,
  FileStorageProvider,
  PgAIStorageProvider,
  PostgreSQLStorageProvider
} from './core/storage';

// Re-export prompt management functions from prompt-management.ts
export {
  ImportOptions,
  ExportOptions,
  ProcessOptions,
  OrganizeOptions
} from './core/prompt-management'; 