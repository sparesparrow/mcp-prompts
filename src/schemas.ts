import { z } from 'zod';

const templateVariableSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  default: z.string().optional(),
  required: z.boolean().optional(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']).optional(),
  options: z.array(z.string()).optional(),
});

/**
 * Base schema for a prompt, containing all user-definable fields.
 * Server-generated fields like id, createdAt, and updatedAt are excluded.
 * This is used for creating new prompts.
 */
const createPromptSchema = z
  .object({
    category: z.string().optional(),
    content: z
      .string({
        invalid_type_error: 'Content must be a string.',
        required_error: 'Content is required.',
      })
      .trim()
      .min(1, { message: 'Content cannot be empty or just whitespace.' }),
    description: z
      .string()
      .trim()
      .max(500, { message: 'Description cannot be longer than 500 characters.' })
      .optional(),
    isTemplate: z.boolean().optional().default(false),
    metadata: z.record(z.unknown()).nullish(),
    name: z
      .string({
        invalid_type_error: 'Name must be a string.',
        required_error: 'Name is required.',
      })
      .trim()
      .min(1, { message: 'Name cannot be empty or just whitespace.' })
      .max(100, { message: 'Name cannot be longer than 100 characters.' }),
    tags: z.array(z.string().min(1, { message: 'Tags cannot be empty strings.' })).nullish(),
    variables: z.array(z.union([z.string(), templateVariableSchema])).nullish(),
  })
  .strict();

/**
 * Schema for a complete prompt object, including server-generated fields.
 * This is used for validating prompts read from storage.
 */
const fullPromptSchema = createPromptSchema.extend({
  createdAt: z.string().datetime(),
  id: z.string().min(1),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
});

/**
 * Schemas for prompt-related API requests, derived from a base schema
 * to ensure consistency.
 */
export const promptSchemas = {
  applyTemplate: z.object({
    id: z.string(),
    variables: z.record(z.string()),
  }),

  /**
   * Schema for creating a new prompt. All fields from the base schema are required.
   */
  create: createPromptSchema,

  delete: z.object({
    id: z.string(),
  }),

  /**
   * Schema for a full prompt object, including server-side fields.
   */
  full: fullPromptSchema,

  get: z.object({
    id: z.string(),
  }),

  list: z.object({
    category: z.string().optional(),
    isTemplate: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }),

  /**
   * Schema for updating an existing prompt. All fields are optional.
   */
  update: createPromptSchema.partial(),

  bulkCreate: z.array(createPromptSchema),

  bulkDelete: z.object({ ids: z.array(z.string().min(1)) }),
};

export type CreatePromptArgs = z.infer<typeof promptSchemas.create>;
export type UpdatePromptArgs = z.infer<typeof promptSchemas.update>;
export type DeletePromptArgs = z.infer<typeof promptSchemas.delete>;
export type ListPromptsArgs = z.infer<typeof promptSchemas.list>;

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

export const workflowStepSchema: z.ZodTypeAny = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({
      condition: z.string().optional(),
      errorPolicy: z.string().optional(),
      id: z.string(),
      input: z.record(z.string()),
      onFailure: z.string().optional(),
      onSuccess: z.string().optional(),
      output: z.string().min(1),
      promptId: z.string(),
      type: z.literal('prompt'),
    }),
    z.object({
      command: z.string(),
      condition: z.string().optional(),
      errorPolicy: z.string().optional(),
      id: z.string(),
      onFailure: z.string().optional(),
      onSuccess: z.string().optional(),
      output: z.string().min(1),
      type: z.literal('shell'),
    }),
    z.object({
      body: z.record(z.any()).optional(),
      condition: z.string().optional(),
      errorPolicy: z.string().optional(),
      id: z.string(),
      method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
      onFailure: z.string().optional(),
      onSuccess: z.string().optional(),
      output: z.string().min(1),
      type: z.literal('http'),
      url: z.string().url(),
    }),
    z.object({
      id: z.string(),
      onFailure: z.string().optional(),
      onSuccess: z.string().optional(),
      steps: z.array(z.lazy(() => workflowStepSchema)),
      type: z.literal('parallel'),
    }),
    z.object({
      condition: z.string().optional(),
      errorPolicy: z.string().optional(),
      id: z.string(),
      onFailure: z.string().optional(),
      onSuccess: z.string().optional(),
      output: z.string().min(1),
      prompt: z.string(),
      timeout: z.number().optional(),
      type: z.literal('human-approval'),
    }),
  ]),
);

export const workflowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    steps: z.array(workflowStepSchema).nonempty({
      message: 'Workflow must have at least one step',
    }),
    variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
    version: z.number(),
  })
  .superRefine((workflow, ctx) => {
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
