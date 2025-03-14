/**
 * File Adapter
 * Implements the StorageAdapter interface for file-based storage
 */

import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Prompt, StorageAdapter, ListPromptsOptions, TemplateVariable } from '../core/types.js';
import { slugify, extractVariables } from '../core/utils.js';

/**
 * File-based storage adapter
 */
export class FileAdapter implements StorageAdapter {
  private promptsDir: string;
  private _isConnected: boolean = false;
  
  /**
   * Create a new file adapter
   * @param promptsDir Directory to store prompts
   */
  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
  }
  
  /**
   * Connect to the file storage
   */
  async connect(): Promise<void> {
    try {
      await fs.ensureDir(this.promptsDir);
      console.log(`Connected to file storage at ${this.promptsDir}`);
      this._isConnected = true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create prompts directory: ${errorMessage}`);
    }
  }
  
  /**
   * Disconnect from the file storage
   */
  async disconnect(): Promise<void> {
    // No-op for file adapter
    this._isConnected = false;
  }
  
  /**
   * Check if connected to the storage
   * @returns Promise that resolves to true if connected, false otherwise
   */
  async isConnected(): Promise<boolean> {
    return this._isConnected;
  }
  
  /**
   * Save a prompt to the file storage
   * @param prompt Prompt to save
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    try {
      // Ensure the prompt has an ID
    if (!prompt.id) {
      prompt.id = uuidv4();
    }
    
      // Create the file path
      const filePath = path.join(this.promptsDir, `${prompt.id}.json`);
      
      // Write the prompt to the file
      await fs.writeJson(filePath, prompt, { spaces: 2 });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to save prompt: ${errorMessage}`);
    }
  }

  /**
   * Get a prompt from the file storage
   * @param id Prompt ID
   * @returns The prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    try {
      // Create the file path
    const filePath = path.join(this.promptsDir, `${id}.json`);
    
      // Read the prompt from the file
      return await fs.readJson(filePath);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to get prompt: ${errorMessage}`);
    }
  }

  /**
   * List prompts from the file storage
   * @param options Options for filtering and sorting
   * @returns Array of prompts
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    try {
      // Get all files in the prompts directory
      const files = await fs.readdir(this.promptsDir);
      
      // Filter for JSON files
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Read all prompts
      const prompts: Prompt[] = await Promise.all(
        jsonFiles.map(async (file) => {
          const filePath = path.join(this.promptsDir, file);
          return await fs.readJson(filePath);
        })
      );
      
      // Apply filtering and sorting if options are provided
      if (options) {
        return this.filterPrompts(prompts, options);
      }
      
      return prompts;
        } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to list prompts: ${errorMessage}`);
    }
  }
  
  /**
   * Delete a prompt from the file storage
   * @param id Prompt ID
   */
  async deletePrompt(id: string): Promise<void> {
    try {
      // Create the file path
      const filePath = path.join(this.promptsDir, `${id}.json`);
      
      // Check if the file exists
      if (await fs.pathExists(filePath)) {
        // Delete the file
        await fs.remove(filePath);
      } else {
        throw new Error(`Prompt with ID ${id} not found`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to delete prompt: ${errorMessage}`);
    }
  }

  /**
   * Filter prompts based on the provided options
   * @param prompts Array of prompts to filter
   * @param options Filtering options
   * @returns Filtered array of prompts
   */
  private filterPrompts(prompts: Prompt[], options: ListPromptsOptions): Prompt[] {
    let filtered = [...prompts];
    
    // Filter by template status
    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(prompt => prompt.isTemplate === options.isTemplate);
    }
    
    // Filter by category
    if (options.category) {
      filtered = filtered.filter(prompt => prompt.category === options.category);
    }
    
    // Filter by tags
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(prompt => {
        if (!prompt.tags) return false;
        return options.tags!.every(tag => prompt.tags!.includes(tag));
      });
    }
    
    // Filter by search term
    if (options.search) {
      const searchLower = options.search.toLowerCase();
      filtered = filtered.filter(prompt => {
        return (
          prompt.name.toLowerCase().includes(searchLower) ||
          (prompt.description && prompt.description.toLowerCase().includes(searchLower)) ||
          prompt.content.toLowerCase().includes(searchLower)
        );
      });
    }
    
    // Sort the results
    if (options.sort) {
      filtered = this.sortPrompts(filtered, options.sort, options.order);
    }
    
    // Apply pagination
    if (options.offset !== undefined || options.limit !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit || filtered.length;
      filtered = filtered.slice(offset, offset + limit);
    }
    
    return filtered;
  }

  /**
   * Sort prompts based on the provided field and order
   * @param prompts Array of prompts to sort
   * @param sort Field to sort by
   * @param order Sort order (asc or desc)
   * @returns Sorted array of prompts
   */
  private sortPrompts(prompts: Prompt[], sort?: string, order?: 'asc' | 'desc'): Prompt[] {
    if (!sort) return prompts;
    
    const sortOrder = order === 'desc' ? -1 : 1;
    
    return [...prompts].sort((a, b) => {
      const aValue = a[sort as keyof Prompt];
      const bValue = b[sort as keyof Prompt];
      
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return sortOrder;
      if (bValue === undefined) return -sortOrder;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return aValue.localeCompare(bValue) * sortOrder;
      }
      
      if (aValue !== undefined && bValue !== undefined) {
        if (aValue < bValue) return -1 * sortOrder;
        if (aValue > bValue) return 1 * sortOrder;
      }
      
      return 0;
    });
  }

  // Additional methods for the adapter
  
  /**
   * Add a new prompt
   * @param prompt Prompt to add
   * @returns The added prompt with ID
   */
  async addPrompt(prompt: Prompt): Promise<Prompt> {
    // Generate an ID if not provided
    if (!prompt.id) {
      prompt.id = uuidv4();
    }
    
    // Set timestamps
    const now = new Date().toISOString();
    prompt.createdAt = now;
    prompt.updatedAt = now;
    
    // Set version
    prompt.version = 1;
    
    // Extract variables if this is a template
    if (prompt.isTemplate) {
      const extractedVars = extractVariables(prompt.content);
      
      // Create proper TemplateVariable objects
      prompt.variables = extractedVars.map(name => ({
        name,
        description: '',
        required: true
      }));
    }
    
    // Save the prompt
    await this.savePrompt(prompt);
    
    return prompt;
  }
  
  /**
   * Update an existing prompt
   * @param id Prompt ID
   * @param updates Partial prompt with updates
   * @returns The updated prompt
   */
  async updatePrompt(id: string, updates: Partial<Prompt>): Promise<Prompt> {
    // Get the existing prompt
    const existing = await this.getPrompt(id);
    
    // Create the updated prompt
    const updated: Prompt = {
      ...existing,
      ...updates,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
      version: (existing.version || 0) + 1,
    };
    
    // Extract variables if this is a template and content changed
    if (updated.isTemplate && updates.content) {
      const extractedVars = extractVariables(updated.content);
      
      // Create proper TemplateVariable objects
      updated.variables = extractedVars.map(name => ({
        name,
        description: '',
        required: true
      }));
    }
    
    // Save the updated prompt
    await this.savePrompt(updated);
    
    return updated;
  }

  /**
   * Get all prompts from the storage
   * This is a direct alias for listPrompts with no options
   * @returns Array of all prompts
   */
  async getAllPrompts(): Promise<Prompt[]> {
    return this.listPrompts();
  }

  /**
   * Clear all prompts from the storage
   */
  async clearAll(): Promise<void> {
    try {
      // Get all files in the prompts directory
      const files = await fs.readdir(this.promptsDir);
      
      // Filter for JSON files
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      // Delete each file
      for (const file of jsonFiles) {
        const filePath = path.join(this.promptsDir, file);
        await fs.remove(filePath);
      }
      
      console.log(`Cleared all prompts from ${this.promptsDir}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to clear all prompts: ${errorMessage}`);
    }
  }
} 