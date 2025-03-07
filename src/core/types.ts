/**
 * Unified Type Definitions for MCP Prompts
 * 
 * This file contains all type definitions used throughout the project.
 */

/**
 * Represents a prompt or template in the system
 */
export interface Prompt {
  /** Unique identifier for the prompt */
  id: string;
  
  /** Display name for the prompt */
  name: string;
  
  /** Optional description */
  description?: string;
  
  /** The actual prompt content */
  content: string;
  
  /** Whether this is a template with variable substitution */
  isTemplate: boolean;
  
  /** List of variable names for templates */
  variables?: string[];
  
  /** Tags for categorization and filtering */
  tags?: string[];
  
  /** Category for organization (e.g., 'development', 'project-orchestration') */
  category?: string;
  
  /** ISO timestamp of creation date */
  createdAt: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
  
  /** Version number for tracking changes */
  version: number;
}

/**
 * Variables for template substitution
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

/**
 * Result of applying a template
 */
export interface ApplyTemplateResult {
  /** Applied content with variables substituted */
  content: string;
  
  /** Original prompt that was used as template */
  originalPrompt: Prompt;
  
  /** Variables that were applied to the template */
  appliedVariables: TemplateVariables;
  
  /** Variables that were in the template but not provided */
  missingVariables?: string[];
}

/**
 * Options for listing prompts with filtering and pagination
 */
export interface ListPromptsOptions {
  /** Filter prompts by tags */
  tags?: string[];
  
  /** Filter prompts by template status */
  isTemplate?: boolean;
  
  /** Filter prompts by category */
  category?: string;
  
  /** Search term to match against name, description, or content */
  search?: string;
  
  /** Field to sort by */
  sort?: string;
  
  /** Sort direction */
  order?: 'asc' | 'desc';
  
  /** Maximum number of prompts to return */
  limit?: number;
  
  /** Number of prompts to skip */
  offset?: number;
}

/**
 * Storage adapter interface for different backend storage systems
 */
export interface StorageAdapter {
  /** Get a prompt by ID */
  getPrompt(id: string): Promise<Prompt>;
  
  /** Save a prompt (create or update) */
  savePrompt(prompt: Prompt): Promise<void>;
  
  /** List prompts with optional filtering */
  listPrompts(options?: ListPromptsOptions): Promise<Prompt[]>;
  
  /** Delete a prompt by ID */
  deletePrompt(id: string): Promise<void>;
  
  /** Connect to the storage backend */
  connect(): Promise<void>;
  
  /** Disconnect from the storage backend */
  disconnect(): Promise<void>;
}

/**
 * Prompt service interface for business logic
 */
export interface PromptService {
  /** Get a prompt by ID */
  getPrompt(id: string): Promise<Prompt>;
  
  /** Add a new prompt */
  addPrompt(prompt: Partial<Prompt>): Promise<Prompt>;
  
  /** Update an existing prompt */
  updatePrompt(id: string, prompt: Partial<Prompt>): Promise<Prompt>;
  
  /** List prompts with optional filtering */
  listPrompts(options?: ListPromptsOptions): Promise<Prompt[]>;
  
  /** Delete a prompt by ID */
  deletePrompt(id: string): Promise<void>;
  
  /** Apply a template with variable substitution */
  applyTemplate(id: string, variables: TemplateVariables): Promise<ApplyTemplateResult>;
} 