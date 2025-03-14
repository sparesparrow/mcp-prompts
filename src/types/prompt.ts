/**
 * Prompt Types
 * Type definitions for prompts in the MCP Prompts Server
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