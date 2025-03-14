/**
 * Storage Adapter Interface
 * Defines the contract for all storage adapters in the MCP Prompts Server
 */

import { Prompt } from '../types/prompt.js';

/**
 * Options for listing prompts
 */
export interface ListPromptsOptions {
  /** Filter by template status */
  isTemplate?: boolean;
  
  /** Filter by category */
  category?: string;
  
  /** Filter by tags (prompts must include all specified tags) */
  tags?: string[];
  
  /** Search term for name, description, and content */
  search?: string;
  
  /** Field to sort by */
  sort?: string;
  
  /** Sort order */
  order?: 'asc' | 'desc';
  
  /** Pagination offset */
  offset?: number;
  
  /** Maximum number of results to return */
  limit?: number;
}

/**
 * Storage adapter interface for prompt storage
 */
export interface StorageAdapter {
  /**
   * Connect to the storage
   */
  connect(): Promise<void>;
  
  /**
   * Disconnect from the storage
   */
  disconnect(): Promise<void>;
  
  /**
   * Check if connected to the storage
   */
  isConnected(): Promise<boolean>;
  
  /**
   * Save a prompt to storage
   * @param prompt Prompt to save
   * @returns Prompt ID
   */
  savePrompt(prompt: Prompt): Promise<string>;
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns Prompt
   */
  getPrompt(id: string): Promise<Prompt>;
  
  /**
   * Get all prompts
   * Returns all prompts, equivalent to listPrompts without options
   * @returns Array of prompts
   */
  getAllPrompts(): Promise<Prompt[]>;
  
  /**
   * List prompts with filtering options
   * If implemented, should provide filtering, sorting, and pagination
   * @param options Filtering options
   * @returns Array of prompts matching options
   */
  listPrompts?(options: ListPromptsOptions): Promise<Prompt[]>;
  
  /**
   * Delete a prompt
   * @param id Prompt ID
   */
  deletePrompt(id: string): Promise<void>;
  
  /**
   * Clear all prompts
   * Removes all prompts from storage
   */
  clearAll(): Promise<void>;
} 