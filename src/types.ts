/**
 * Unified Types Module for MCP Prompts Server
 * 
 * This file consolidates all type definitions used throughout the project.
 */

/**
 * Represents a prompt or template in the system
 */
export interface Prompt {
  /** Unique identifier for the prompt */
  id: string;
  
  /** Display name for the prompt */
  name: string;
  
  /** URL-friendly version of the name */
  slug?: string;
  
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
  
  /** Number of times this prompt has been used */
  usage_count?: number;
  
  /** Last time this prompt was used */
  last_used?: string;
  
  /** ISO timestamp of creation date */
  createdAt: string;
  
  /** ISO timestamp of last update */
  updatedAt: string;
  
  /** Version number for tracking changes */
  version: number;
  
  /** Source information about where the prompt came from */
  source?: string;
  
  /** Any additional metadata as key-value pairs */
  metadata?: Record<string, any>;
}

/**
 * Variables for template substitution
 */
export interface TemplateVariables {
  [key: string]: string | number | boolean;
}

/**
 * Options for listing prompts with filtering and pagination
 */
export interface ListPromptsOptions {
  /** Filter prompts by tag */
  tag?: string;
  
  /** Filter prompts by template status */
  isTemplate?: boolean;
  
  /** Filter prompts by category */
  category?: string;
  
  /** Search term to match against name, description, or content */
  search?: string;
  
  /** Field to sort by (name, createdAt, updatedAt) */
  sort?: string;
  
  /** Sort direction */
  order?: 'asc' | 'desc';
  
  /** Maximum number of prompts to return */
  limit?: number;
  
  /** Number of prompts to skip */
  offset?: number;
  
  /** Legacy: Filter templates only (replaced by isTemplate) */
  templatesOnly?: boolean;
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
 * Import options interface for prompt management
 */
export interface ImportOptions {
  source?: string;
  skipConfirm?: boolean;
  dryRun?: boolean;
  force?: boolean;
}

/**
 * Export options interface for prompt management
 */
export interface ExportOptions {
  format?: 'json' | 'zip' | 'markdown';
  tags?: string[];
  outFile?: string;
}

/**
 * Process options interface for prompt management
 */
export interface ProcessOptions {
  shouldCleanup?: boolean;
  shouldBackup?: boolean;
  rawPromptsFile?: string;
}

/**
 * Organizing options interface for prompt management
 */
export interface OrganizeOptions {
  dryRun?: boolean;
  force?: boolean;
  verbose?: boolean;
}

/**
 * Tag management options interface
 */
export interface TagOptions {
  action: 'list' | 'add' | 'remove' | 'rename';
  tag?: string;
  newTag?: string;
  promptIds?: string[];
}

/**
 * Pipeline options interface for prompt management
 */
export interface PipelineOptions {
  dryRun?: boolean;
  verbose?: boolean;
  shouldCleanup?: boolean;
}

/**
 * Validation result for prompt validation
 */
export interface ValidationResult {
  /** Whether the validation passed */
  valid: boolean;
  
  /** Error message if validation failed */
  error?: string;
} 