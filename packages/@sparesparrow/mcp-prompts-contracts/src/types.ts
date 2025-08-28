/**
 * Core domain types for MCP Prompts
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

  /** The actual prompt content */
  content: string;

  /** Whether this is a template prompt */
  isTemplate: boolean;

  /** Date when the prompt was created (ISO string) */
  createdAt: string;

  /** Date when the prompt was last updated (ISO string) */
  updatedAt: string;

  /** Version number, incremented on updates */
  version: number;

  /** Optional description of the prompt */
  description?: string;

  /** Primary category for organization */
  category?: string;

  /** Optional metadata for additional information */
  metadata?: Record<string, unknown>;

  /** Tags for categorization and filtering */
  tags?: string[];

  /** For templates, the list of variables */
  variables?: (string | TemplateVariable)[];
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

export type TemplateVariables = Record<string, string>;

export interface ApplyTemplateResult {
  content: string;
  originalPrompt: Prompt;
  appliedVariables: TemplateVariables;
  missingVariables?: string[];
}

export interface CreatePromptParams {
  id?: string;
  name: string;
  description?: string;
  content: string;
  tags?: string[];
  isTemplate: boolean;
  variables?: string[] | TemplateVariable[];
  metadata?: Record<string, unknown>;
  category?: string;
}

export interface UpdatePromptParams {
  id: string;
  name?: string;
  description?: string;
  content?: string;
  tags?: string[] | null;
  isTemplate?: boolean;
  variables?: string[] | TemplateVariable[] | null;
  metadata?: Record<string, unknown> | null;
  category?: string;
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

export interface PromptSequence {
  id: string;
  name: string;
  description?: string;
  steps: Array<{
    id: string;
    promptId: string;
    order: number;
    condition?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  version: number;
}
