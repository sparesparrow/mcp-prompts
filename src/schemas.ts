import { z } from 'zod';

export const workflowSchema = z.object({
  id: z.string(),
  version: z.string(), // Changed to string for consistency
  steps: z.array(z.any()).default([]),
});

// Agent configuration schema
export const agentConfigSchema = z.object({
  model: z.enum(['claude-opus', 'claude-sonnet', 'claude-haiku']).optional(),
  systemPrompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  mcpServers: z.array(z.string()).optional(),
  subagents: z.array(z.string()).optional(),
  compatibleWith: z.array(z.string()).optional(),
  sourceUrl: z.string().optional(),
  executionCount: z.number().optional(),
  successRate: z.number().optional(),
  lastExecutedAt: z.string().datetime().optional(),
});

// Core prompt schema - uses 'template' as primary content field
export const promptBaseSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  template: z.string().min(1), // PRIMARY field for content
  category: z.string().default('general'),
  tags: z.array(z.string()).default([]),
  variables: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      description: z.string().optional(),
      required: z.boolean().default(true),
      type: z.enum(['string', 'number', 'boolean']).default('string')
    })
  ])).default([]),
  version: z.string().default('1'), // Version as string
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  isLatest: z.boolean().default(true),
  metadata: z.record(z.any()).default({}),
  accessLevel: z.string().default('public'),
  authorId: z.string().optional(),
  promptType: z.enum(['standard', 'subagent_registry', 'main_agent_template', 'project_orchestration_template']).default('standard'),
  agentConfig: agentConfigSchema.optional(),
});

export const promptSchemas = {
  list: z.object({
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    isTemplate: z.coerce.boolean().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
  }),
  create: promptBaseSchema.omit({ id: true, createdAt: true, updatedAt: true }).required({ name: true, template: true }),
  get: z.object({
    id: z.string(),
    version: z.string().optional(),
  }),
  applyTemplate: z.object({
    id: z.string(),
    variables: z.record(z.any(), z.any()).default({}).optional(),
  }),
  update: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    template: z.string().min(1).optional(), // Use 'template' not 'content'
    tags: z.array(z.string()).optional(),
    variables: z.array(z.union([z.string(), z.object({ name: z.string() })])).optional(),
    metadata: z.record(z.any()).optional(),
    accessLevel: z.string().optional(),
    promptType: z.enum(['standard', 'subagent_registry', 'main_agent_template', 'project_orchestration_template']).optional(),
    agentConfig: agentConfigSchema.optional(),
  }),
};

export type PromptListQuery = z.infer<typeof promptSchemas.list>;
export type CreatePromptInput = z.infer<typeof promptSchemas.create>;
export type UpdatePromptInput = z.infer<typeof promptSchemas.update>;
export type PromptBase = z.infer<typeof promptBaseSchema>;

