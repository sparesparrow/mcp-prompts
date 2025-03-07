import fs from 'fs/promises';
import path from 'path';
import { Prompt, StorageAdapter, ListPromptsOptions } from '../core/types';
import { validatePrompt } from '../core/utils';

/**
 * Storage adapter implementation that uses the filesystem
 */
export class FileAdapter implements StorageAdapter {
  private promptsDir: string;
  
  /**
   * Create a new FileAdapter instance
   * @param promptsDir Directory to store prompt files
   */
  constructor(promptsDir: string) {
    this.promptsDir = promptsDir;
  }
  
  /**
   * Ensure the prompts directory exists
   */
  async connect(): Promise<void> {
    try {
      await fs.mkdir(this.promptsDir, { recursive: true });
    } catch (error: any) {
      throw new Error(`Failed to create prompts directory: ${error.message}`);
    }
  }
  
  /**
   * No-op for file adapter
   */
  async disconnect(): Promise<void> {
    // No resources to release for filesystem storage
  }
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns Promise resolving to the prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    try {
      const filePath = path.join(this.promptsDir, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf8');
      const prompt = JSON.parse(content) as Prompt;
      
      if (!validatePrompt(prompt)) {
        throw new Error(`Invalid prompt data for ID: ${id}`);
      }
      
      return prompt;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Prompt not found: ${id}`);
      }
      throw new Error(`Failed to get prompt: ${error.message}`);
    }
  }
  
  /**
   * Save a prompt to the filesystem
   * @param prompt Prompt to save
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    try {
      if (!validatePrompt(prompt)) {
        throw new Error('Invalid prompt data');
      }
      
      const filePath = path.join(this.promptsDir, `${prompt.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(prompt, null, 2), 'utf8');
    } catch (error: any) {
      throw new Error(`Failed to save prompt: ${error.message}`);
    }
  }
  
  /**
   * List prompts with optional filtering
   * @param options Filtering and pagination options
   * @returns Promise resolving to an array of prompts
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    try {
      const files = await fs.readdir(this.promptsDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const prompts: Prompt[] = [];
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.promptsDir, file);
          const content = await fs.readFile(filePath, 'utf8');
          const prompt = JSON.parse(content);
          
          if (validatePrompt(prompt)) {
            prompts.push(prompt);
          }
        } catch (error: any) {
          console.error(`Error reading prompt file ${file}: ${error.message}`);
          // Continue with other files
        }
      }
      
      return this.filterPrompts(prompts, options);
    } catch (error: any) {
      throw new Error(`Failed to list prompts: ${error.message}`);
    }
  }
  
  /**
   * Delete a prompt by ID
   * @param id Prompt ID to delete
   */
  async deletePrompt(id: string): Promise<void> {
    try {
      const filePath = path.join(this.promptsDir, `${id}.json`);
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Prompt not found: ${id}`);
      }
      throw new Error(`Failed to delete prompt: ${error.message}`);
    }
  }
  
  /**
   * Filter prompts based on provided options
   * @param prompts Array of prompts to filter
   * @param options Filtering and pagination options
   * @returns Filtered array of prompts
   */
  private filterPrompts(prompts: Prompt[], options?: ListPromptsOptions): Prompt[] {
    if (!options) return prompts;
    
    let filtered = [...prompts];
    
    // Filter by tags (logical OR - prompt has at least one of the specified tags)
    if (options.tags && options.tags.length > 0) {
      filtered = filtered.filter(prompt => 
        prompt.tags && options.tags?.some(tag => prompt.tags?.includes(tag))
      );
    }
    
    // Filter by template status
    if (options.isTemplate !== undefined) {
      filtered = filtered.filter(prompt => prompt.isTemplate === options.isTemplate);
    }
    
    // Filter by category
    if (options.category) {
      filtered = filtered.filter(prompt => prompt.category === options.category);
    }
    
    // Filter by search term (in name, description or content)
    if (options.search) {
      const search = options.search.toLowerCase();
      filtered = filtered.filter(prompt => 
        prompt.name.toLowerCase().includes(search) ||
        (prompt.description && prompt.description.toLowerCase().includes(search)) ||
        prompt.content.toLowerCase().includes(search)
      );
    }
    
    // Sort results
    if (options.sort) {
      const sortField = options.sort as keyof Prompt;
      const sortOrder = options.order === 'desc' ? -1 : 1;
      
      filtered.sort((a, b) => {
        const aValue = a[sortField];
        const bValue = b[sortField];
        
        if (aValue === undefined || bValue === undefined) {
          return 0;
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortOrder * aValue.localeCompare(bValue);
        }
        
        if (aValue < bValue) return -1 * sortOrder;
        if (aValue > bValue) return 1 * sortOrder;
        return 0;
      });
    }
    
    // Apply pagination
    if (options.limit !== undefined || options.offset !== undefined) {
      const offset = options.offset || 0;
      const limit = options.limit !== undefined ? options.limit : filtered.length;
      filtered = filtered.slice(offset, offset + limit);
    }
    
    return filtered;
  }
} 