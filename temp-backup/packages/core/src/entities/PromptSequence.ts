import { z } from 'zod';

/**
 * PromptSequence entity - represents a sequence of prompts for workflow execution
 */
export interface PromptSequence {
  /** Unique identifier for the sequence */
  id: string;

  /** Human-readable name of the sequence */
  name: string;

  /** Optional description of the sequence */
  description?: string;

  /** Array of prompt IDs in execution order */
  promptIds: string[];

  /** Date when the sequence was created (ISO string) */
  createdAt: string;

  /** Date when the sequence was last updated (ISO string) */
  updatedAt: string;

  /** Optional metadata for additional information */
  metadata?: Record<string, any>;

  /** Tags for categorization and filtering */
  tags?: string[];

  /** Version number for the sequence */
  version: number;
}

/**
 * Zod schema for PromptSequence validation
 */
export const PromptSequenceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  promptIds: z.array(z.string().min(1)).min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  version: z.number().int().positive(),
});

/**
 * Type for creating a new prompt sequence
 */
export type CreatePromptSequenceParams = Omit<PromptSequence, 'id' | 'createdAt' | 'updatedAt' | 'version'>;

/**
 * Type for updating an existing prompt sequence
 */
export type UpdatePromptSequenceParams = Partial<Omit<PromptSequence, 'id' | 'createdAt' | 'updatedAt' | 'version'>>;
