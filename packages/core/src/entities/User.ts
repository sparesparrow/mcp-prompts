import { z } from 'zod';

/**
 * User entity - represents a user in the system
 */
export interface User {
  /** Unique identifier for the user */
  id: string;

  /** Username for authentication */
  username: string;

  /** Email address of the user */
  email: string;

  /** Display name of the user */
  displayName?: string;

  /** User's role for authorization */
  role: 'admin' | 'user' | 'readonly';

  /** Date when the user was created (ISO string) */
  createdAt: string;

  /** Date when the user was last updated (ISO string) */
  updatedAt: string;

  /** Date when the user last logged in (ISO string) */
  lastLoginAt?: string;

  /** Whether the user account is active */
  isActive: boolean;

  /** Optional metadata for additional information */
  metadata?: Record<string, any>;

  /** API keys associated with the user */
  apiKeys?: string[];
}

/**
 * Zod schema for User validation
 */
export const UserSchema = z.object({
  id: z.string().min(1),
  username: z.string().min(3).max(50),
  email: z.string().email(),
  displayName: z.string().max(100).optional(),
  role: z.enum(['admin', 'user', 'readonly']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().optional(),
  isActive: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
  apiKeys: z.array(z.string()).optional(),
});

/**
 * Type for creating a new user
 */
export type CreateUserParams = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>;

/**
 * Type for updating an existing user
 */
export type UpdateUserParams = Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Type for user authentication
 */
export type UserCredentials = {
  username: string;
  password: string;
};

/**
 * Type for user session
 */
export type UserSession = {
  userId: string;
  token: string;
  expiresAt: string;
  permissions: string[];
};
