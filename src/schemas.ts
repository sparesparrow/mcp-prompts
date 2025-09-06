import { z } from 'zod';

export const workflowSchema = z.object({
  id: z.string(),
  version: z.number().int().nonnegative(),
  steps: z.array(z.any()).default([]),
});

export const promptSchemas = {
  list: z.object({
    tags: z.union([z.array(z.string()), z.string()]).optional(),
    isTemplate: z.coerce.boolean().optional(),
    search: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50).optional(),
    offset: z.coerce.number().int().min(0).default(0).optional(),
  }),
  applyTemplate: z.object({
    id: z.string(),
    variables: z.record(z.any(), z.any()).default({}).optional(),
  }),
  update: z.object({
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    isTemplate: z.boolean().nullable().optional(),
    metadata: z.record(z.any(),z.any()).nullable().optional(),
    tags: z.array(z.string()).nullable().optional(),
    variables: z.array(z.union([z.string(), z.object({ name: z.string() })])).nullable().optional(),
  }),
};

export type PromptListQuery = z.infer<typeof promptSchemas.list>;

