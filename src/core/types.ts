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
 * Storage adapter interface for prompt storage
 */
export interface StorageAdapter {
  /**
   * Check if connected to the storage
   * @returns Promise that resolves to true if connected, false otherwise
   */
  isConnected(): Promise<boolean>;
  
  /**
   * Connect to the storage
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the storage
   */
  disconnect(): Promise<void>;
  
  /**
   * Save a prompt to storage
   * @param prompt Prompt to save
   */
  savePrompt(prompt: Prompt): Promise<void>;
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns The prompt
   */
  getPrompt(id: string): Promise<Prompt>;
  
  /**
   * List prompts with filtering options
   * @param options Filtering options
   * @returns Array of prompts matching options
   */
  listPrompts(options?: ListPromptsOptions): Promise<Prompt[]>;
  
  /**
   * Delete a prompt
   * @param id Prompt ID
   */
  deletePrompt(id: string): Promise<void>;
  
  /**
   * Get all prompts from storage
   * @returns Array of all prompts
   */
  getAllPrompts(): Promise<Prompt[]>;
  
  /**
   * Clear all prompts from storage
   */
  clearAll(): Promise<void>;
}

/**
 * Template variables map
 * Maps variable names to their values
 */
export type TemplateVariables = Record<string, string | number | boolean>;

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