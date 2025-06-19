/**
 * Unified Interface Definitions
 * Contains all interface definitions for the MCP Prompts Server
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { z } from 'zod';

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
  variables?: string[] | TemplateVariable[];
  
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
 * Format options for MutablePrompt conversion
 */
export enum PromptFormat {
  /** Standard JSON format */
  JSON = 'json',
  
  /** Cursor Rules MDC format */
  MDC = 'mdc',
  
  /** PGAI format with embeddings support */
  PGAI = 'pgai',
  
  /** Dynamic template with variable placeholders */
  TEMPLATE = 'template'
}

/**
 * Cursor Rules MDC format options
 */
export interface MdcFormatOptions {
  /** Optional glob patterns for file matching */
  globs?: string[];

  /** Include variables section */
  includeVariables?: boolean;
}

/**
 * PGAI format options 
 */
export interface PgaiFormatOptions {
  /** Generate embeddings for content */
  generateEmbeddings?: boolean;

  /** Vector search configuration */
  vectorConfig?: {
    /** Vector dimension */
    dimension: number;
    
    /** Vector distance metric */
    metric: 'cosine' | 'euclidean' | 'manhattan';
  };
  
  /** Collection name in PGAI */
  collection?: string;
}

/**
 * Template format options
 */
export interface TemplateFormatOptions {
  /** Variable delimiter style */
  delimiterStyle?: 'curly' | 'double_curly' | 'dollar' | 'percent';
  
  /** Provide default values for variables */
  defaultValues?: Record<string, string>;
  
  /** Programming language for code variables */
  codeLanguage?: string;
}

/**
 * Conversion options for MutablePrompt
 */
export interface PromptConversionOptions {
  /** MDC format specific options */
  mdc?: MdcFormatOptions;
  
  /** PGAI format specific options */
  pgai?: PgaiFormatOptions;
  
  /** Template format specific options */
  template?: TemplateFormatOptions;
}

/**
 * MutablePrompt interface
 * 
 * Extended prompt interface that can be converted between different formats:
 * - Standard JSON (internal format)
 * - Cursor Rules MDC format
 * - PGAI format with embeddings
 * - Template with variables for dynamic substitution
 */
export interface MutablePrompt extends Prompt {
  /**
   * Convert the prompt to a different format
   * 
   * @param format Target format to convert to
   * @param options Format-specific conversion options
   * @returns The prompt in the specified format
   */
  toFormat(format: PromptFormat, options?: PromptConversionOptions): string | Record<string, any>;
  
  /**
   * Convert the prompt to MDC format
   * 
   * @param options MDC-specific options
   * @returns The prompt as an MDC formatted string
   */
  toMdc(options?: MdcFormatOptions): string;
  
  /**
   * Convert the prompt to PGAI format
   * 
   * @param options PGAI-specific options
   * @returns The prompt in PGAI format
   */
  toPgai(options?: PgaiFormatOptions): Record<string, any>;
  
  /**
   * Convert the prompt to a template with placeholders
   * 
   * @param options Template-specific options
   * @returns The prompt as a template string
   */
  toTemplate(options?: TemplateFormatOptions): string;
  
  /**
   * Apply variable substitution to a template prompt
   * 
   * @param variables Key-value pairs for variable substitution
   * @param options Template processing options
   * @returns The content with variables substituted
   */
  applyVariables(variables: Record<string, string>, options?: TemplateFormatOptions): string;
  
  /**
   * Extract variables from the prompt content
   * 
   * @param options Format-specific options for extraction
   * @returns Array of variable names found in the content
   */
  extractVariables(options?: TemplateFormatOptions): string[];
  
  /**
   * Clone the prompt
   * 
   * @returns A new instance of MutablePrompt with the same properties
   */
  clone(): MutablePrompt;
  
  /**
   * Create a new version of the prompt
   * 
   * @param changes Partial changes to apply to the new version
   * @returns A new prompt with incremented version
   */
  createVersion(changes: Partial<Prompt>): MutablePrompt;
}

/**
 * Factory for creating MutablePrompt instances
 */
export interface MutablePromptFactory {
  /**
   * Create a new MutablePrompt instance
   * 
   * @param data Initial prompt data
   * @returns A new MutablePrompt instance
   */
  create(data: Partial<Prompt>): MutablePrompt;
  
  /**
   * Convert from a string format to a MutablePrompt
   * 
   * @param content String content in a specific format
   * @param format The format of the input content
   * @param options Conversion options
   * @returns A new MutablePrompt instance
   */
  fromFormat(content: string, format: PromptFormat, options?: PromptConversionOptions): MutablePrompt;
  
  /**
   * Convert from MDC format to a MutablePrompt
   * 
   * @param mdcContent MDC formatted string
   * @param options MDC-specific options
   * @returns A new MutablePrompt instance
   */
  fromMdc(mdcContent: string, options?: MdcFormatOptions): MutablePrompt;
  
  /**
   * Convert from PGAI format to a MutablePrompt
   * 
   * @param pgaiData PGAI formatted data
   * @param options PGAI-specific options
   * @returns A new MutablePrompt instance
   */
  fromPgai(pgaiData: Record<string, any>, options?: PgaiFormatOptions): MutablePrompt;
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
  /**
   * Connect to the storage
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the storage
   */
  disconnect(): Promise<void>;
  
  /**
   * Check if connected to the storage
   */
  isConnected(): boolean | Promise<boolean>;
  
  /**
   * Save a prompt to storage
   * @param prompt Prompt to save
   * @returns Prompt ID or the full prompt
   */
  savePrompt(prompt: Prompt): Promise<Prompt>;
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns Prompt
   */
  getPrompt(id: string): Promise<Prompt | null>;
  
  /**
   * Get all prompts
   * @returns Array of prompts
   */
  getAllPrompts(): Promise<Prompt[]>;
  
  /**
   * Update a prompt
   * @param id Prompt ID
   * @param data Updated prompt data
   * @returns Updated prompt or void
   */
  updatePrompt(id: string, prompt: Prompt): Promise<Prompt>;
  
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
   * Clear all prompts
   * Removes all prompts from storage
   */
  clearAll?(): Promise<void>;
  
  /**
   * Backup the storage
   * @returns Backup ID
   */
  backup?(): Promise<string>;
  
  /**
   * Restore from a backup
   * @param backupId Backup ID
   */
  restore?(backupId: string): Promise<void>;
  
  /**
   * List available backups
   * @returns Array of backup IDs
   */
  listBackups?(): Promise<string[]>;

  /**
   * Get a prompt sequence by ID
   * @param id Sequence ID
   * @returns PromptSequence
   */
  getSequence(id: string): Promise<PromptSequence | null>;

  /**
   * Save a prompt sequence to storage
   * @param sequence PromptSequence to save
   * @returns The saved PromptSequence
   */
  saveSequence(sequence: PromptSequence): Promise<PromptSequence>;

  /**
   * Delete a prompt sequence
   * @param id Sequence ID
   */
  deleteSequence(id: string): Promise<void>;
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
  getPrompt(id: string): Promise<Prompt | null>;
  
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
 * Project interface
 */
export interface Project {
  /**
   * Unique identifier for the project
   */
  id: string;
  
  /**
   * Name of the project
   */
  name: string;
  
  /**
   * Optional description of the project
   */
  description?: string;
  
  /**
   * Optional tags for categorization
   */
  tags?: string[];
  
  /**
   * Creation timestamp
   */
  createdAt?: string;
  
  /**
   * Last update timestamp
   */
  updatedAt?: string;
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

/**
 * Server configuration interface
 */
export interface ServerConfig {
  /** Server name */
  name: string;
  
  /** Server version */
  version: string;
  
  /** Storage type */
  storageType: 'file' | 'postgres' | 'memory' | 'mdc';
  
  /** File storage directory */
  promptsDir: string;
  
  /** Backups directory */
  backupsDir: string;
  
  /** HTTP server port */
  port: number;
  
  /** Log level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  
  /** Enable HTTP server */
  httpServer: boolean;
  
  /** Enable MCP server */
  mcpServer: boolean;
  
  /** HTTP server host */
  host: string;
  
  /** Enable Server-Sent Events (SSE) */
  enableSSE?: boolean;
  
  /** SSE endpoint path */
  ssePath?: string;
  
  /** CORS origin setting */
  corsOrigin?: string;
  
  /** PostgreSQL configuration */
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    connectionString?: string;
  };
}

/**
 * Error interface with additional context
 */
export interface ErrorWithContext extends Error {
  /** Error code */
  code?: string;
  
  /** HTTP status code */
  statusCode?: number;
  
  /** Additional context object */
  context?: Record<string, any>;
  
  /** Original error if this wraps another error */
  originalError?: Error;
}

export interface StorageConfig {
  type: 'file' | 'memory' | 'postgres';
  promptsDir?: string;  // For file storage
  backupsDir?: string;  // For file storage
  pgHost?: string;      // For postgres storage
  pgPort?: number;      // For postgres storage
  pgUser?: string;      // For postgres storage
  pgPassword?: string;  // For postgres storage
  pgDatabase?: string;  // For postgres storage
}

/**
 * PromptSequence interface
 * Represents an ordered sequence of prompts
 */
export interface PromptSequence {
  /** Unique identifier for the sequence */
  id: string;

  /** Human-readable name of the sequence */
  name: string;

  /** Optional description of the sequence */
  description?: string;

  /** Ordered list of prompt IDs in the sequence */
  promptIds: string[];

  /** Date when the sequence was created (ISO string) */
  createdAt: string;

  /** Date when the sequence was last updated (ISO string) */
  updatedAt: string;

  /** Optional metadata for additional information */
  metadata?: Record<string, any>;
}

export interface MCPServerCapabilities {
  prompts: boolean;
  templates: boolean;
  sequences: boolean;
  streaming: boolean;
  elicitation: boolean;
}

export interface MCPServerConfig {
  name: string;
  version: string;
  capabilities: MCPServerCapabilities;
}

export interface AddPromptInput {
  name: string;
  content: string;
  description?: string;
  isTemplate?: boolean;
  tags?: string[];
  variables?: string[];
}

export interface EditPromptInput {
  id: string;
  name?: string;
  content?: string;
  description?: string;
  isTemplate?: boolean;
  tags?: string[];
  variables?: string[];
}

export interface GetPromptInput {
  id: string;
}

export interface ListPromptsInput {
  tags?: string[];
}

export interface ApplyTemplateInput {
  id: string;
  variables: Record<string, string>;
}

export interface PromptServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface CreateSequenceInput {
  name: string;
  steps: Array<{
    promptId: string;
    variables?: Record<string, string>;
  }>;
  description?: string;
  tags?: string[];
}

export interface ExecuteSequenceInput {
  id: string;
  variables?: Record<string, string>;
}

export interface SequenceExecutionResult {
  id: string;
  name: string;
  results: Array<{
    stepIndex: number;
    promptId: string;
    result: string;
  }>;
}

export interface StreamingPromptResult {
  type: 'token' | 'error' | 'end';
  content?: string;
  error?: string;
}

export interface ElevenLabsConfig {
  apiKey: string;
  modelId?: string;
  voiceId?: string;
  optimizationLevel?: 'speed' | 'quality' | 'balanced';
  stability?: number;
  similarityBoost?: number;
  speakerBoost?: boolean;
  style?: number;
  useCaching?: boolean;
  cachePath?: string;
}

export interface AudioGenerationOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  optimizationPreset?: 'speed' | 'quality' | 'balanced';
  stability?: number;
  similarityBoost?: number;
  speakerBoost?: boolean;
  style?: number;
}

export interface AudioGenerationResult {
  audioData: Buffer;
  metadata: {
    duration: number;
    wordCount: number;
    charCount: number;
    costEstimate: number;
  };
  cacheInfo?: {
    hit: boolean;
    path?: string;
  };
} 