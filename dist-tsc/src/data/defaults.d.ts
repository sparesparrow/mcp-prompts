import type { Prompt, StorageAdapter } from '../interfaces.js';
/**
 * A list of default prompts to be loaded into storage if the store is empty.
 */
export declare const DEFAULT_PROMPTS: Omit<Prompt, 'id' | 'createdAt' | 'updatedAt' | 'version'>[];
/**
 * Initializes the storage with default prompts if it is currently empty.
 * @param storageAdapter - The storage adapter to use for saving prompts.
 */
export declare function initializeDefaultPrompts(storageAdapter: StorageAdapter): Promise<void>;
