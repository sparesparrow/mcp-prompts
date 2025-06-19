import { z } from 'zod';

/**
 * Schemas for prompt-related API requests.
 */
export const promptSchemas = {
  add: z.object({
    name: z.string(),
    content: z.string(),
    description: z.string().optional(),
    isTemplate: z.boolean().optional(),
    variables: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
  get: z.object({
    id: z.string(),
  }),
  update: z.object({
    id: z.string(),
    name: z.string().optional(),
    content: z.string().optional(),
    description: z.string().optional(),
    isTemplate: z.boolean().optional(),
    variables: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
  }),
  delete: z.object({
    id: z.string(),
  }),
  list: z.object({
    tags: z.array(z.string()).optional(),
    isTemplate: z.boolean().optional(),
    category: z.string().optional(),
  }),
  applyTemplate: z.object({
    id: z.string(),
    variables: z.record(z.string()),
  }),
}; 