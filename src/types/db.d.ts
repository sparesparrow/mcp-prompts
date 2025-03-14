/**
 * Type declarations for database utility functions
 */

import { Prompt } from './prompt';

/**
 * Initialize the database
 */
export function initDatabase(): Promise<void>;

/**
 * Get all prompts from files in the specified directory
 * @param directory Directory containing prompt files
 */
export function getAllPromptsFromFiles(directory: string): Promise<Prompt[]>;

/**
 * Get all prompts from the database
 * @param connectionString PostgreSQL connection string
 */
export function getAllPromptsFromDb(connectionString: string): Promise<Prompt[]>;

/**
 * Save a prompt to a file
 * @param prompt Prompt object to save
 * @param directory Directory to save the file in
 */
export function savePromptToFile(prompt: Prompt, directory: string): Promise<string>;

/**
 * Save a prompt to the database
 * @param prompt Prompt object to save
 * @param connectionString PostgreSQL connection string
 */
export function savePromptToDb(prompt: Prompt, connectionString: string): Promise<string>;

/**
 * Create a backup of all prompts
 * @param backupDir Directory to store the backup
 * @param options Backup options
 */
export function createBackup(backupDir: string, options?: {
  storage?: {
    type?: 'postgres' | 'file';
    pgConnectionString?: string;
    promptsDir?: string;
  }
}): Promise<string>;

/**
 * List all backups in the specified directory
 * @param backupDir Directory containing backups
 */
export function listBackups(backupDir: string): Promise<Array<{
  name: string;
  path: string;
  timestamp: string;
  count: number | null;
  sourceType?: string;
  version?: string;
}>>;

/**
 * Restore from a backup
 * @param backupPath Path to the backup directory
 * @param options Restore options
 */
export function restoreFromBackup(backupPath: string, options?: {
  clearExisting?: boolean;
  storage?: {
    type?: 'postgres' | 'file';
    pgConnectionString?: string;
    promptsDir?: string;
  }
}): Promise<number>; 