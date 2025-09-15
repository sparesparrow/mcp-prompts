import { z } from 'zod';

/**
 * Prompt entity - represents a prompt in the system
 */
export interface Prompt {
  /** Unique identifier for the prompt */
  id: string;

  /** Human-readable name of the prompt */
  name: string;

  /** The actual prompt content */
  content: string;

  /** Whether this is a template prompt */
  isTemplate: boolean;

  /** Date when the prompt was created (ISO string) */
  createdAt: string;

  /** Date when the prompt was last updated (ISO string) */
  updatedAt: string;

  /** Version number, incremented on updates */
  version: number;

  /** Optional description of the prompt */
  description?: string;

  /** Primary category for organization */
  category?: string;

  /** Optional metadata for additional information */
  metadata?: Record<string, unknown>;

  /** Tags for categorization and filtering */
  tags?: string[];

  /** For templates, the list of variables */
  variables?: (string | {
    name: string;
    description?: string;
    default?: string;
    required?: boolean;
    type?: "string" | "number" | "boolean" | "object" | "array";
    options?: string[];
  })[];
}

/**
 * Zod schema for Prompt validation
 */
export const PromptSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  content: z.string().min(1),
  isTemplate: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  version: z.number().int().positive(),
  description: z.string().max(500).optional(),
  category: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  variables: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      description: z.string().optional(),
      default: z.string().optional(),
      required: z.boolean().optional(),
      type: z.enum(['string', 'number', 'boolean', 'object', 'array']).optional(),
      options: z.array(z.string()).optional(),
    })
  ])).optional(),
});

/**
 * Type for creating a new prompt
 */
export type CreatePromptParams = Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'version'>;

/**
 * Type for updating an existing prompt
 */
export type UpdatePromptParams = Partial<Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'version'>>;
