import { z } from 'zod';

/**
 * TemplateVariable entity - represents a variable in a template prompt
 */
export interface TemplateVariable {
  /** The variable name in the template (without { }) */
  name: string;

  /** Description of the variable */
  description?: string;

  /** Default value for the variable */
  default?: string;

  /** Whether the variable is required */
  required?: boolean;

  /** Type of the variable */
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';

  /** Possible values for the variable (for enum-like variables) */
  options?: string[];
}

/**
 * Zod schema for TemplateVariable validation
 */
export const TemplateVariableSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  default: z.string().optional(),
  required: z.boolean().optional(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']).optional(),
  options: z.array(z.string()).optional(),
});

/**
 * Type for template variables (can be string or object)
 */
export type TemplateVariableInput = string | TemplateVariable;

/**
 * Type for template variables in prompts
 */
export type TemplateVariables = Record<string, string>;
