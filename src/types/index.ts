/**
 * Type definitions for the MCP Prompts server
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
 * Options for listing prompts
 */
export interface ListPromptsOptions {
  /** Filter prompts by tag */
  tag?: string;
  
  /** Filter templates only */
  templatesOnly?: boolean;
  
  /** Maximum number of prompts to return */
  limit?: number;
}

/**
 * Result of applying a template
 */
export interface ApplyTemplateResult {
  /** Original template */
  template: Prompt;
  
  /** Applied content with variables substituted */
  content: string;
  
  /** Variables used for substitution */
  variables: TemplateVariables;
} 