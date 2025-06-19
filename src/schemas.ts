import { z } from 'zod';

/**
 * Schemas for prompt-related API requests.
 */
export const promptSchemas = {
  add: z.object({
    content: z.string(),
    description: z.string().optional(),
    isTemplate: z.boolean().optional(),
    name: z.string(),
    tags: z.array(z.string()).optional(),
    variables: z.array(z.string()).optional(),
  }),
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
  update: z.object({
    content: z.string().optional(),
    description: z.string().optional(),
    id: z.string(),
    isTemplate: z.boolean().optional(),
    name: z.string().optional(),
    tags: z.array(z.string()).optional(),
    variables: z.array(z.string()).optional(),
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

export const workflowStepSchema = z.discriminatedUnion('type', [
  z.object({
    condition: z.string().optional(),
    errorPolicy: z.string().optional(),
    id: z.string(),
    input: z.record(z.any()),
    output: z.string(),
    promptId: z.string(),
    type: z.literal('prompt'),
  }),
  z.object({
    command: z.string(),
    condition: z.string().optional(),
    errorPolicy: z.string().optional(),
    id: z.string(),
    output: z.string(),
    type: z.literal('shell'),
  }),
  z.object({
    body: z.any().optional(),
    condition: z.string().optional(),
    errorPolicy: z.string().optional(),
    id: z.string(),
    method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
    output: z.string(),
    type: z.literal('http'),
    url: z.string(),
  }),
]);

export const workflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  steps: z.array(workflowStepSchema),
  variables: z.record(z.any()).optional(),
  version: z.number(),
});
