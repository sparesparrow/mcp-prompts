import { z } from 'zod';

/**
 * Base schema for a prompt, containing all user-definable fields.
 * Server-generated fields like id, createdAt, and updatedAt are excluded.
 */
const basePromptSchema = z.object({
  content: z.string()
    .trim()
    .min(1, { message: 'Content cannot be empty or whitespace' }),
  description: z.string().optional(),
  name: z
    .string()
    .trim()
    .min(1, { message: 'Name cannot be empty' }),
  isTemplate: z.boolean().optional().default(false),
  category: z.string().optional(),
  metadata: z.record(z.unknown()).nullish(),
  tags: z.array(z.string()).nullish(),
  variables: z.array(z.union([z.string(), z.object({})])).nullish(),
});

/**
 * Schemas for prompt-related API requests, derived from a base schema
 * to ensure consistency.
 */
export const promptSchemas = {
  /**
   * Schema for creating a new prompt. All fields from the base schema are required.
   */
  create: basePromptSchema,
  /**
   * Schema for updating an existing prompt. All fields are optional.
   */
  update: basePromptSchema.partial(),
  applyTemplate: z.object({
    id: z.string(),
    variables: z.record(z.string()),
  }),
  delete: z.object({
    id: z.string(),
  }),
  get: z.object({
    id: z.string(),
  }),
  list: z.object({
    category: z.string().optional(),
    isTemplate: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }),
};

/**
 * Zod schema for Workflow definitions (MVP).
 *
 * Top-level fields:
 * - id: string (unique workflow ID)
 * - name: string (human-readable name)
 * - version: number (schema version)
 * - variables: object (optional, key-value pairs for workflow-wide variables)
 * - steps: array of step objects (see below)
 *
 * Step object (discriminated by 'type'):
 * - id: string (unique step ID)
 * - type: 'prompt' | 'shell' | 'http'
 * - prompt: { promptId, input, output } (for type 'prompt')
 * - shell: { command, output } (for type 'shell')
 * - http: { method, url, body?, output } (for type 'http')
 * - condition: string (optional, expression to determine if step runs)
 * - errorPolicy: string (optional, e.g., 'continue', 'abort', 'retry<n>')
 *
 * All step types support 'output', 'condition', and 'errorPolicy'.
 */

export const workflowStepSchema: z.ZodTypeAny = z.lazy(() => z.discriminatedUnion('type', [
  z.object({
    condition: z.string().optional(),
    errorPolicy: z.string().optional(),
    id: z.string(),
    input: z.record(z.string()),
    output: z.string().min(1),
    promptId: z.string(),
    type: z.literal('prompt'),
    onSuccess: z.string().optional(),
    onFailure: z.string().optional(),
  }),
  z.object({
    command: z.string(),
    condition: z.string().optional(),
    errorPolicy: z.string().optional(),
    id: z.string(),
    output: z.string().min(1),
    type: z.literal('shell'),
    onSuccess: z.string().optional(),
    onFailure: z.string().optional(),
  }),
  z.object({
    body: z.record(z.any()).optional(),
    condition: z.string().optional(),
    errorPolicy: z.string().optional(),
    id: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    output: z.string().min(1),
    type: z.literal('http'),
    url: z.string().url(),
    onSuccess: z.string().optional(),
    onFailure: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('parallel'),
    steps: z.array(z.lazy(() => workflowStepSchema)),
    onSuccess: z.string().optional(),
    onFailure: z.string().optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal('human-approval'),
    prompt: z.string(),
    output: z.string().min(1),
    timeout: z.number().optional(),
    onSuccess: z.string().optional(),
    onFailure: z.string().optional(),
    condition: z.string().optional(),
    errorPolicy: z.string().optional(),
  }),
]));

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(workflowStepSchema).nonempty({
    message: 'Workflow must have at least one step',
  }),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  version: z.number(),
}).superRefine((workflow, ctx) => {
  const stepIds = new Set(workflow.steps.map(s => s.id));

  workflow.steps.forEach((step, index) => {
    if (step.onSuccess && !stepIds.has(step.onSuccess)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid onSuccess ID: '${step.onSuccess}' does not exist in this workflow.`,
        path: ['steps', index, 'onSuccess'],
      });
    }
    if (step.onFailure && !stepIds.has(step.onFailure)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid onFailure ID: '${step.onFailure}' does not exist in this workflow.`,
        path: ['steps', index, 'onFailure'],
      });
    }
  });
});
