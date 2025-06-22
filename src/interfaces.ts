/**
 * Unified Interface Definitions
 * Contains all interface definitions for the MCP Prompts Server
 */

import type { z } from 'zod';

import type { McpConfigSchema } from './config.js';

export type McpConfig = z.infer<typeof McpConfigSchema>;

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
  TEMPLATE = 'template',
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

export interface PromptConversion {
  toFormat(format: PromptFormat, options?: PromptConversionOptions): string | Record<string, any>;
  toMdc(options?: MdcFormatOptions): string;
  toPgai(options?: PgaiFormatOptions): Record<string, any>;
  toTemplate(options?: TemplateFormatOptions): string;
  applyVariables(variables: Record<string, string>, options?: TemplateFormatOptions): string;
  extractVariables(options?: TemplateFormatOptions): string[];
}

export interface MutablePrompt extends Prompt, PromptConversion {
  clone(): MutablePrompt;
  createVersion(changes: Partial<Prompt>): MutablePrompt;
}

export interface PromptFactory {
  create(data: Partial<Prompt>): MutablePrompt;
  fromFormat(
    format: PromptFormat,
    content: string | Record<string, any>,
    options?: PromptConversionOptions,
  ): MutablePrompt;
  fromMdc(mdcContent: string, options?: MdcFormatOptions): MutablePrompt;
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
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean | Promise<boolean>;
  savePrompt(prompt: Prompt): Promise<Prompt>;
  /**
   * Get a prompt by ID and version. If version is omitted, returns the latest version.
   */
  getPrompt(id: string, version?: number): Promise<Prompt | null>;
  /**
   * List all versions for a prompt ID (sorted ascending).
   */
  listPromptVersions(id: string): Promise<number[]>;
  /**
   * Update a specific version of a prompt. If version is omitted, updates the latest.
   */
  updatePrompt(id: string, version: number, prompt: Partial<Prompt>): Promise<Prompt>;
  /**
   * Delete a specific version of a prompt. If version is omitted, deletes all versions.
   */
  deletePrompt(id: string, version?: number): Promise<boolean>;
  /**
   * List prompts (latest version only by default).
   */
  listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
  clearAll?(): Promise<void>;
  backup?(): Promise<string>;
  restore?(backupId: string): Promise<void>;
  listBackups?(): Promise<string[]>;
  getSequence(id: string): Promise<PromptSequence | null>;
  saveSequence(sequence: PromptSequence): Promise<PromptSequence>;
  deleteSequence(id: string): Promise<void>;
  healthCheck?(): Promise<boolean>;

  // Workflow State Management
  saveWorkflowState(state: WorkflowExecutionState): Promise<void>;
  getWorkflowState(executionId: string): Promise<WorkflowExecutionState | null>;
  listWorkflowStates(workflowId: string): Promise<WorkflowExecutionState[]>;
}

export interface WorkflowExecutionState {
  executionId: string;
  workflowId: string;
  version: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  currentStepId?: string;
  context: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    stepId: string;
    executedAt: string;
    success: boolean;
    output?: any;
    error?: string;
  }>;
}

export type TemplateVariables = Record<string, string>;

export interface ApplyTemplateResult {
  content: string;
  originalPrompt: Prompt;
  appliedVariables: TemplateVariables;
  missingVariables?: string[];
}

export interface PromptService {
  getPrompt(id: string, version?: number): Promise<Prompt | null>;
  addPrompt(data: Partial<Prompt>): Promise<Prompt>;
  updatePrompt(id: string, version: number, data: Partial<Prompt>): Promise<Prompt>;
  listPrompts(options?: ListPromptsOptions, allVersions?: boolean): Promise<Prompt[]>;
  deletePrompt(id: string, version?: number): Promise<boolean>;
  listPromptVersions(id: string): Promise<number[]>;
  applyTemplate(
    id: string,
    variables: TemplateVariables,
    version?: number,
  ): Promise<ApplyTemplateResult>;
}

export interface CreatePromptParams {
  id?: string;
  name: string;
  description?: string;
  content: string;
  tags?: string[];
  isTemplate?: boolean;
  variables?: string[] | TemplateVariable[];
  metadata?: Record<string, any>;
}

export interface UpdatePromptParams {
  id: string;
  name?: string;
  description?: string;
  content?: string;
  tags?: string[];
  isTemplate?: boolean;
  variables?: string[] | TemplateVariable[];
  metadata?: Record<string, any>;
}

export interface ListPromptsParams {
  tags?: string[];
  isTemplate?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ApplyTemplateParams {
  id: string;
  variables: Record<string, string>;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
}

export type AddPromptParams = CreatePromptParams;
export interface GetPromptParams {
  id: string;
}
export interface DeletePromptParams {
  id: string;
}

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

export interface ServerConfig {
  name: string;
  version: string;
  storageType: 'file' | 'postgres' | 'memory';
  promptsDir: string;
  backupsDir: string;
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  httpServer: boolean;
  mcpServer: boolean;
  host: string;
  enableSSE?: boolean;
  ssePath?: string;
  corsOrigin?: string;
  postgres?: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl: boolean;
    connectionString?: string;
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    ttl?: number;
  };
}

export interface ErrorWithContext extends Error {
  code?: string;
  statusCode?: number;
  context?: Record<string, any>;
  originalError?: Error;
}

export interface StorageConfig {
  type: 'file' | 'memory' | 'postgres';
  promptsDir?: string;
  backupsDir?: string;
  pgHost?: string;
  pgPort?: number;
  pgUser?: string;
  pgPassword?: string;
  pgDatabase?: string;
}

export interface PromptSequence {
  id: string;
  name: string;
  description?: string;
  promptIds: string[];
  createdAt: string;
  updatedAt: string;
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
