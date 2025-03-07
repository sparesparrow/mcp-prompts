import * as fs from 'fs/promises';
import * as path from 'path';
import { Prompt, PromptStorage, ListPromptOptions } from '../types';

/**
 * File-based prompt storage provider
 */
export class FileStorageProvider implements PromptStorage {
  private baseDir: string;
  private usageDataPath: string;
  private usageData: Record<string, { usageCount: number, lastUsed: string }> = {};

  constructor(baseDir: string) {
    this.baseDir = baseDir;
    this.usageDataPath = path.join(baseDir, 'usage-analytics.json');
    this.loadUsageData();
  }

  /**
   * Load usage analytics data from storage
   */
  private async loadUsageData(): Promise<void> {
    try {
      const data = await fs.readFile(this.usageDataPath, 'utf8');
      this.usageData = JSON.parse(data);
    } catch (error) {
      // If file doesn't exist or is invalid, initialize empty usage data
      console.log('No usage analytics data found, starting fresh');
      this.usageData = {};
    }
  }

  /**
   * Save usage analytics data to storage
   */
  private async saveUsageData(): Promise<void> {
    try {
      await fs.writeFile(this.usageDataPath, JSON.stringify(this.usageData, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving usage analytics data:', error);
    }
  }

  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns The prompt or null if not found
   */
  async getPrompt(id: string): Promise<Prompt | null> {
    const filePath = path.join(this.baseDir, `${id}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const prompt = JSON.parse(data) as Prompt;
      
      // Add usage data if available
      if (this.usageData[id]) {
        prompt.usageCount = this.usageData[id].usageCount;
        prompt.lastUsed = this.usageData[id].lastUsed;
      }
      
      return prompt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  /**
   * List prompts with optional filtering
   * @param options Filter options
   * @returns Array of prompts
   */
  async listPrompts(options?: ListPromptOptions): Promise<Prompt[]> {
    const files = await fs.readdir(this.baseDir);
    const promptFiles = files.filter(file => file.endsWith('.json') && file !== 'usage-analytics.json');
    
    const prompts: Prompt[] = [];
    
    for (const file of promptFiles) {
      try {
        const data = await fs.readFile(path.join(this.baseDir, file), 'utf8');
        const prompt = JSON.parse(data) as Prompt;
        
        // Add usage data if available
        const id = prompt.id;
        if (this.usageData[id]) {
          prompt.usageCount = this.usageData[id].usageCount;
          prompt.lastUsed = this.usageData[id].lastUsed;
        }
        
        // Apply filters
        if (
          (options?.tags && options.tags.length > 0 && 
           !prompt.tags?.some(tag => options.tags!.includes(tag))) ||
          (options?.templatesOnly !== undefined && 
           prompt.isTemplate !== options.templatesOnly) ||
          (options?.category !== undefined && 
           prompt.category !== options.category)
        ) {
          continue;
        }
        
        prompts.push(prompt);
      } catch (error) {
        console.error(`Error reading prompt file ${file}:`, error);
      }
    }
    
    return prompts.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Add or update a prompt
   * @param prompt The prompt to save
   */
  async addPrompt(prompt: Prompt): Promise<void> {
    const filePath = path.join(this.baseDir, `${prompt.id}.json`);
    
    // Set default category if not present
    if (!prompt.category) {
      prompt.category = 'development';
    }
    
    // Keep existing usage data if available
    if (this.usageData[prompt.id]) {
      prompt.usageCount = this.usageData[prompt.id].usageCount;
      prompt.lastUsed = this.usageData[prompt.id].lastUsed;
    }
    
    await fs.writeFile(filePath, JSON.stringify(prompt, null, 2), 'utf8');
  }

  /**
   * Delete a prompt
   * @param id Prompt ID
   * @returns True if a prompt was deleted, false otherwise
   */
  async deletePrompt(id: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
      
      // Also remove usage data if it exists
      if (this.usageData[id]) {
        delete this.usageData[id];
        await this.saveUsageData();
      }
      
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Increment usage count and update last used timestamp
   * @param id Prompt ID
   */
  async incrementUsage(id: string): Promise<void> {
    // Create or update usage data for this prompt
    if (!this.usageData[id]) {
      this.usageData[id] = { usageCount: 0, lastUsed: new Date().toISOString() };
    }
    
    this.usageData[id].usageCount += 1;
    this.usageData[id].lastUsed = new Date().toISOString();
    
    await this.saveUsageData();
  }

  /**
   * Get prompt usage analytics
   * @returns Array of prompt analytics data
   */
  async getPromptAnalytics(): Promise<{ id: string, name: string, usageCount: number, lastUsed: string | Date }[]> {
    const prompts = await this.listPrompts();
    const analytics: { id: string, name: string, usageCount: number, lastUsed: string | Date }[] = [];
    
    for (const prompt of prompts) {
      if (this.usageData[prompt.id]) {
        analytics.push({
          id: prompt.id,
          name: prompt.name,
          usageCount: this.usageData[prompt.id].usageCount,
          lastUsed: this.usageData[prompt.id].lastUsed
        });
      } else {
        analytics.push({
          id: prompt.id,
          name: prompt.name,
          usageCount: 0,
          lastUsed: prompt.updatedAt
        });
      }
    }
    
    // Sort by usage count descending
    return analytics.sort((a, b) => b.usageCount - a.usageCount);
  }

  /**
   * Close resources
   */
  async close(): Promise<void> {
    // Nothing to close for file-based storage
    await this.saveUsageData();
  }
} 