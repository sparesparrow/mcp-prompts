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
