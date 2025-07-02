import { z } from 'zod';

export const PromptIdSchema = z.string().uuid();
export const TagSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/);

export const TemplateVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'date']),
  required: z.boolean(),
});

export const TemplateSchema = z.object({
  id: z.string(),
  content: z.string(),
  variables: z.array(TemplateVariableSchema),
});

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
});

export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string().optional(),
  email: z.string().optional(),
});

export const PromptSchema = z.object({
  id: PromptIdSchema,
  name: z.string(),
  template: TemplateSchema,
  category: CategorySchema,
  tags: z.array(TagSchema),
  createdBy: UserSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});
