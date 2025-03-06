/**
 * Core type definitions for MCP Prompts Server
 */

/**
 * A prompt stored in the system
 */
export interface Prompt {
  /**
   * Unique identifier for the prompt
   */
  id: string;
  
  /**
   * Display name for the prompt
   */
  name: string;
  
  /**
   * The actual prompt content
   */
  content: string;
  
  /**
   * Optional description of the prompt
   */
  description?: string;
  
  /**
   * Tags for categorization and filtering
   */
  tags?: string[];
  
  /**
   * Whether this is a template prompt with variables
   */
  isTemplate: boolean;
  
  /**
   * For templates, the variable names that can be replaced
   */
  variables?: string[];
  
  /**
   * Timestamp when the prompt was created
   */
  createdAt: string | Date;
  
  /**
   * Timestamp when the prompt was last updated
   */
  updatedAt: string | Date;
  
  /**
   * Version number for the prompt
   */
  version: number;
  
  /**
   * Additional metadata for the prompt
   */
  metadata?: Record<string, any>;
}

/**
 * Options for listing prompts
 */
export interface ListPromptOptions {
  /**
   * Filter by tags (prompts must have at least one of these tags)
   */
  tags?: string[];
  
  /**
   * Filter by template status
   */
  templatesOnly?: boolean;
}

/**
 * Interface for prompt storage providers
 */
export interface PromptStorage {
  /**
   * Get a prompt by ID
   */
  getPrompt(id: string): Promise<Prompt | null>;
  
  /**
   * List prompts with optional filtering
   */
  listPrompts(options?: ListPromptOptions): Promise<Prompt[]>;
  
  /**
   * Add or update a prompt
   */
  addPrompt(prompt: Prompt): Promise<void>;
  
  /**
   * Delete a prompt
   */
  deletePrompt(id: string): Promise<boolean>;
  
  /**
   * Close storage resources
   */
  close(): Promise<void>;
} 