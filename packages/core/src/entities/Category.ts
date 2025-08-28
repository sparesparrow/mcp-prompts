import { z } from 'zod';

/**
 * Category entity - represents a category for organizing prompts
 */
export interface Category {
  /** Unique identifier for the category */
  id: string;

  /** Human-readable name of the category */
  name: string;

  /** Optional description of the category */
  description?: string;

  /** Parent category ID for hierarchical organization */
  parentId?: string;

  /** Date when the category was created (ISO string) */
  createdAt: string;

  /** Date when the category was last updated (ISO string) */
  updatedAt: string;

  /** Optional metadata for additional information */
  metadata?: Record<string, any>;

  /** Color or icon for visual representation */
  color?: string;

  /** Icon identifier for the category */
  icon?: string;
}

/**
 * Zod schema for Category validation
 */
export const CategorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(50),
  description: z.string().max(200).optional(),
  parentId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  metadata: z.record(z.unknown()).optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

/**
 * Type for creating a new category
 */
export type CreateCategoryParams = Omit<Category, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * Type for updating an existing category
 */
export type UpdateCategoryParams = Partial<Omit<Category, 'id' | 'createdAt' | 'updatedAt'>>;
