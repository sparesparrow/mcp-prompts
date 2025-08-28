/**
 * @sparesparrow/mcp-prompts-contracts
 * Shared TypeScript types and validation schemas for MCP Prompts ecosystem
 */

// Core domain types
export type { 
  Prompt,
  TemplateVariable,
  PromptFormat,
  MdcFormatOptions,
  PgaiFormatOptions,
  TemplateFormatOptions,
  PromptConversionOptions,
  PromptConversion,
  MutablePrompt,
  PromptFactory,
  ListPromptsOptions,
  TemplateVariables,
  ApplyTemplateResult,
  CreatePromptParams,
  UpdatePromptParams,
  ListPromptsParams,
  ApplyTemplateParams,
  Project,
  ToolResponse,
  AddPromptParams,
  GetPromptParams,
  DeletePromptParams,
  WorkflowExecutionState,
  PromptSequence
} from './types.js';

// Validation schemas
export { 
  promptSchemas,
  workflowSchema,
  workflowStepSchema
} from './schemas.js';

// Schema-inferred types
export type {
  CreatePromptArgs,
  ListPromptsArgs
} from './schemas.js';

// Storage and configuration types
export type {
  StorageAdapter,
  ServerConfig
} from './config.js';