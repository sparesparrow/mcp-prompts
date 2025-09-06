// Core types for the MCP Prompts system

// Re-export entity types
export type { Prompt, CreatePromptParams, UpdatePromptParams } from '../entities/Prompt';
export type { TemplateVariable, TemplateVariableInput, TemplateVariables } from '../entities/TemplateVariable';
export type { PromptSequence, CreatePromptSequenceParams, UpdatePromptSequenceParams } from '../entities/PromptSequence';
export type { Category, CreateCategoryParams, UpdateCategoryParams } from  '../entities/Category';
export type { User, CreateUserParams, UpdateUserParams, UserCredentials, UserSession } from '../entities/User';

// Re-export value object types
export type { PromptId, PromptIdType } from '../value-objects/PromptId';
export type { Tag, TagType, Tags } from '../value-objects/Tag';
export type { TemplateVariable as TemplateVariableVO, TemplateVariableType } from '../value-objects/TemplateVariable';

// Re-export port types
export type { IPromptRepository } from '../ports/IPromptRepository';
export type { IPromptApplication } from '../ports/IPromptApplication';
export type {  ITemplatingEngine } from '../types/manual-exports';
export type { IEventPublisher } from '../ports/IEventPublisher';
export type { ISecurityValidator } from '../ports/ISecurityValidator'; 

// Common types
export type TemplateVariables = Record<string, string>;

export interface ApplyTemplateResult {
  content: string;
  originalPrompt: Prompt;
  appliedVariables: TemplateVariables;
  missingVariables?: string[];
}

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

export interface PromptServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
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
