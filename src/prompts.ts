import { z } from 'zod';

// Define prompt argument schemas
const createPromptArgsSchema = z.object({
  category: z.string().optional().describe('Primary category for the prompt'),
  content: z.string().describe('The actual prompt content/template'),
  description: z.string().optional().describe('Description of what the prompt does'),
  isTemplate: z.boolean().optional().default(false).describe('Whether this is a template prompt'),
  metadata: z.record(z.any()).optional().describe('Additional metadata for the prompt'),
  name: z.string().describe('Name of the prompt'),
  tags: z.array(z.string()).optional().describe('Tags to categorize the prompt'),
  variables: z.array(z.string()).optional().describe('Variables that can be used in the template'),
});

const updatePromptArgsSchema = createPromptArgsSchema.partial().extend({
  id: z.string().describe('ID of the prompt to update'),
});

const deletePromptArgsSchema = z.object({
  id: z.string().describe('ID of the prompt to delete'),
});

const listPromptsArgsSchema = z.object({
  category: z.string().optional().describe('Filter prompts by category'),
  isTemplate: z.boolean().optional().describe('Filter for template/non-template prompts'),
  tag: z.string().optional().describe('Filter prompts by tag'),
});

// Export schemas for use in server registration
export const promptSchemas = {
  create: createPromptArgsSchema,
  delete: deletePromptArgsSchema,
  list: listPromptsArgsSchema,
  update: updatePromptArgsSchema,
};

// Export types derived from schemas
export type CreatePromptArgs = z.infer<typeof createPromptArgsSchema>;
export type UpdatePromptArgs = z.infer<typeof updatePromptArgsSchema>;
export type DeletePromptArgs = z.infer<typeof deletePromptArgsSchema>;
export type ListPromptsArgs = z.infer<typeof listPromptsArgsSchema>;

// Define some example prompts
export const defaultPrompts = {
  'bug-report': {
    category: 'development',
    content:
      'Issue Type: Bug\n\nDescription:\n{{description}}\n\nSteps to Reproduce:\n{{steps}}\n\nExpected Behavior:\n{{expected}}\n\nActual Behavior:\n{{actual}}\n\nEnvironment:\n{{environment}}',
    description: 'Generate a detailed bug report',
    isTemplate: true,
    name: 'bug-report',
    tags: ['development', 'issues'],
    variables: ['description', 'steps', 'expected', 'actual', 'environment'],
  },
  'code-review': {
    category: 'development',
    content:
      'Please review the following code changes:\n\n{{code}}\n\nProvide feedback on:\n1. Code quality\n2. Potential bugs\n3. Performance considerations\n4. Security implications\n5. Suggested improvements',
    description: 'Review code changes and provide feedback',
    isTemplate: true,
    name: 'code-review',
    tags: ['development', 'review'],
    variables: ['code'],
  },
};
