/**
 * Core Types
 * Type definitions for the MCP Prompts Server
 */

/**
 * Variable definition for templates
 */
export interface TemplateVariable {
  /** The variable name in the template (without { }) */
  name: string;
  
  /** Description of the variable */
  description?: string;
  
  /** Default value for the variable */
  default?: string;
  
  /** Whether the variable is required */
  required?: boolean;
  
  /** Type of the variable */
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  
  /** Possible values for the variable (for enum-like variables) */
  options?: string[];
}

/**
 * Prompt interface
 * Represents a prompt in the system, either a template or a concrete prompt
 */
export interface Prompt {
  /** Unique identifier for the prompt */
  id: string;
  
  /** Human-readable name of the prompt */
  name: string;
  
  /** Optional description of the prompt */
  description?: string;
  
  /** The actual prompt content */
  content: string;
  
  /** Whether this is a template prompt */
  isTemplate?: boolean;
  
  /** For templates, the list of variables */
  variables?: TemplateVariable[];
  
  /** Tags for categorization and filtering */
  tags?: string[];
  
  /** Primary category for organization */
  category?: string;
  
  /** Date when the prompt was created (ISO string) */
  createdAt: string;
  
  /** Date when the prompt was last updated (ISO string) */
  updatedAt: string;
  
  /** Version number, incremented on updates */
  version?: number;
  
  /** Optional metadata for additional information */
  metadata?: Record<string, any>;
}

/**
 * Options for listing prompts
 */
export interface ListPromptsOptions {
  /** Filter by template status */
  isTemplate?: boolean;
  
  /** Filter by category */
  category?: string;
  
  /** Filter by tags (prompts must include all specified tags) */
  tags?: string[];
  
  /** Search term for name, description, and content */
  search?: string;
  
  /** Field to sort by */
  sort?: string;
  
  /** Sort order */
  order?: 'asc' | 'desc';
  
  /** Pagination offset */
  offset?: number;
  
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Base storage adapter interface 
 */
export interface StorageAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean | Promise<boolean>;
  
  // Get a prompt by ID
  getPrompt(id: string): Promise<Prompt>;
  
  // Get all prompts
  getAllPrompts(): Promise<Prompt[]>;
  
  // Create a new prompt - allow void or Prompt return type
  savePrompt(prompt: Partial<Prompt>): Promise<Prompt | void>;
  
  // Update a prompt - make this optional since some adapters might not implement it
  updatePrompt?(id: string, data: Partial<Prompt>): Promise<Prompt | void>;
  
  // Delete a prompt
  deletePrompt(id: string): Promise<void>;
  
  // List prompts with filtering options
  listPrompts(options?: ListPromptsOptions): Promise<Prompt[]>;
  
  // Clear all prompts - make this optional
  clearAll?(): Promise<void>;
  
  // Backup operations - these are optional
  backup?(): Promise<string>;
  restore?(backupId: string): Promise<void>;
  listBackups?(): Promise<string[]>;
}

/**
 * Template variables map
 * Maps variable names to their values
 */
export type TemplateVariables = Record<string, string>;

/**
 * Result of applying a template
 */
export interface ApplyTemplateResult {
  /** The resulting content after applying variables */
  content: string;
  
  /** The original prompt template */
  originalPrompt: Prompt;
  
  /** The variables that were applied */
  appliedVariables: TemplateVariables;
  
  /** Any variables that were missing from the input */
  missingVariables?: string[];
}

/**
 * Prompt service interface
 */
export interface PromptService {
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns The prompt
   */
  getPrompt(id: string): Promise<Prompt>;
  
  /**
   * Add a new prompt
   * @param data Partial prompt data
   * @returns The created prompt
   */
  addPrompt(data: Partial<Prompt>): Promise<Prompt>;
  
  /**
   * Update an existing prompt
   * @param id Prompt ID
   * @param data Updated prompt data
   * @returns The updated prompt
   */
  updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt>;
  
  /**
   * List prompts with optional filtering
   * @param options Filter options
   * @returns Filtered list of prompts
   */
  listPrompts(options?: ListPromptsOptions): Promise<Prompt[]>;
  
  /**
   * Delete a prompt
   * @param id Prompt ID
   */
  deletePrompt(id: string): Promise<void>;
  
  /**
   * Apply a template
   * @param id Template ID
   * @param variables Variables to apply
   * @returns The applied template result
   */
  applyTemplate(id: string, variables: TemplateVariables): Promise<ApplyTemplateResult>;
}

/**
 * Interface for creating a new prompt
 */
export interface CreatePromptParams {
  id?: string;
  name: string;
  description?: string;
  content: string;
  tags?: string[];
  isTemplate?: boolean;
  variables?: string[];
  metadata?: Record<string, any>;
}

/**
 * Interface for updating a prompt
 */
export interface UpdatePromptParams {
  id: string;
  name?: string;
  description?: string;
  content?: string;
  tags?: string[];
  isTemplate?: boolean;
  variables?: string[];
  metadata?: Record<string, any>;
}

/**
 * Interface for listing prompts with filters
 */
export interface ListPromptsParams {
  tags?: string[];
  isTemplate?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Interface for applying template variables
 */
export interface ApplyTemplateParams {
  id: string;
  variables: Record<string, string>;
}

/**
 * Response for tool operations
 */
export interface ToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

/**
 * MCP Tool Parameters
 */
export type AddPromptParams = CreatePromptParams;
export type GetPromptParams = { id: string };
export type DeletePromptParams = { id: string };

/**
 * MCP Request Handler Extra
 */
export interface McpRequestExtra {
  arguments: any;
  request: {
    id: string;
    method: string;
    params: {
      name: string;
      arguments: any;
    };
  };
} 