import type { Prompt } from './interfaces.js';
import { promptSchemas } from './schemas.js';
import type { z } from 'zod';

export class ValidationError extends Error {
  public issues: z.ZodIssue[];

  public constructor(message: string, issues: z.ZodIssue[]) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export function validatePrompt(
  prompt: unknown,
  throwOnError = true,
): { success: boolean; data?: Prompt; error?: z.ZodError } {
  const result = promptSchemas.create.safeParse(prompt);
  if (!result.success) {
    if (throwOnError) {
      const errorMessages = result.error.issues
        .map(issue => `${issue.path.join('.')} - ${issue.message}`)
        .join(', ');
      throw new ValidationError(`Prompt validation failed: ${errorMessages}`, result.error.issues);
    }
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data as Prompt };
} 