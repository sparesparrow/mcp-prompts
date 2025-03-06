/**
 * MCP Prompts Server Core
 * This file contains all the core types, interfaces, and configuration settings
 */

import path from 'path';

/**
 * Prompt interface that defines the structure of a prompt
 */
export interface Prompt {
  /**
   * Unique identifier for the prompt
   */
  id: string;
  
  /**
   * User-friendly name for the prompt
   */
  name: string;
  
  /**
   * The actual prompt content that will be sent to the LLM
   */
  content: string;
  
  /**
   * Optional description of what the prompt does
   */
  description?: string;
  
  /**
   * Optional array of tags for categorization
   */
  tags?: string[];
  
  /**
   * Whether this prompt is a template with variables
   */
  isTemplate: boolean;
  
  /**
   * Array of variable names found in the template
   */
  variables?: string[];
  
  /**
   * When the prompt was created
   */
  createdAt: Date;
  
  /**
   * When the prompt was last updated
   */
  updatedAt: Date;
  
  /**
   * Version number of the prompt
   */
  version: number;
  
  /**
   * Optional metadata with any additional information
   */
  metadata?: Record<string, any>;
}

/**
 * Options for listing prompts
 */
export interface ListPromptOptions {
  /**
   * Optional filter by tags
   */
  tags?: string[];
  
  /**
   * Optional filter for templates only
   */
  templatesOnly?: boolean;
}

/**
 * Interface for prompt storage providers
 */
export interface PromptStorage {
  /**
   * Get a prompt by its ID
   * @param id The ID of the prompt to retrieve
   * @returns The prompt or null if not found
   */
  getPrompt(id: string): Promise<Prompt | null>;
  
  /**
   * List all prompts with optional filtering
   * @param options Optional filtering options
   * @returns Array of prompts
   */
  listPrompts(options?: ListPromptOptions): Promise<Prompt[]>;
  
  /**
   * Add or update a prompt
   * @param prompt The prompt to add or update
   * @returns The added prompt
   */
  addPrompt(prompt: Prompt): Promise<Prompt>;
  
  /**
   * Delete a prompt by its ID
   * @param id The ID of the prompt to delete
   * @returns Whether the deletion was successful
   */
  deletePrompt(id: string): Promise<boolean>;
  
  /**
   * Search prompts by content (semantic search)
   * @param content The content to search for
   * @param limit Maximum number of results to return
   * @returns Array of prompts matching the search
   */
  searchPromptsByContent?(content: string, limit?: number): Promise<Prompt[]>;
  
  /**
   * Close the storage provider and release resources
   */
  close(): Promise<void>;
}

/**
 * Configuration for the server
 */
export interface ServerConfig {
  /**
   * Port to run the server on
   */
  port?: number;
  
  /**
   * Host to bind the server to
   */
  host?: string;
  
  /**
   * Log level for the server
   */
  logLevel?: 'dev' | 'combined' | 'common' | 'short' | 'tiny' | 'none';
}

/**
 * Configuration for file storage
 */
export interface FileStorageConfig {
  /**
   * Base directory for file storage
   */
  baseDir: string;
}

/**
 * Configuration for PGAI storage
 */
export interface PgAIStorageConfig {
  /**
   * PostgreSQL connection string for PGAI
   */
  connectionString: string;
  
  /**
   * Optional schema name for PGAI tables
   */
  schema?: string;
  
  /**
   * Optional table name for storing prompts
   */
  tableName?: string;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  /**
   * Type of storage to use
   */
  type: 'file' | 'pgai';
  
  /**
   * Options specific to the storage type
   */
  options: FileStorageConfig | PgAIStorageConfig;
}

/**
 * Main configuration interface
 */
export interface Config {
  /**
   * Server configuration
   */
  server: ServerConfig;
  
  /**
   * Storage configuration
   */
  storage: StorageConfig;
}

/**
 * Default configuration
 */
export const defaultConfig: Config = {
  server: {
    port: 3000,
    host: 'localhost',
    logLevel: 'dev'
  },
  storage: {
    type: 'file',
    options: {
      baseDir: path.join(process.cwd(), 'prompts')
    }
  }
};

/**
 * Create configuration by merging provided config with defaults
 * @param config The configuration to merge with defaults
 * @returns The merged configuration
 */
export function createConfig(config: Partial<Config> = {}): Config {
  // Deep merge with defaults
  return {
    server: {
      ...defaultConfig.server,
      ...config.server
    },
    storage: {
      ...defaultConfig.storage,
      ...config.storage,
      options: {
        ...(config.storage?.type === defaultConfig.storage.type
          ? defaultConfig.storage.options 
          : config.storage?.type === 'pgai' 
            ? { connectionString: 'postgresql://postgres:postgres@localhost:5432/mcp_prompts' } 
            : defaultConfig.storage.options),
        ...(config.storage?.options || {})
      }
    }
  };
}

/**
 * Apply a template with variables
 * @param prompt The template prompt
 * @param variables The variables to apply
 * @returns The prompt content with variables replaced
 */
export function applyTemplate(prompt: Prompt, variables: Record<string, string>): string {
  if (!prompt.isTemplate) {
    return prompt.content;
  }
  
  let content = prompt.content;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    content = content.replace(regex, value);
  }
  
  return content;
}

/**
 * Extract variable names from a template content
 * @param content The template content to extract variables from
 * @returns Array of variable names
 */
export function extractVariables(content: string): string[] {
  const regex = /{{([^{}]+)}}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const variable = match[1].trim();
    if (!variables.includes(variable)) {
      variables.push(variable);
    }
  }
  
  return variables;
} 