import fs from 'fs/promises';
import path from 'path';
import { Prompt, PromptStorage, ListPromptOptions } from '../types';

/**
 * File-based storage provider for prompts
 */
export class FileStorageProvider implements PromptStorage {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  async getPrompt(id: string): Promise<Prompt | null> {
    try {
      const filePath = path.join(this.baseDir, `${id}.json`);
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content) as Prompt;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async listPrompts(options?: ListPromptOptions): Promise<Prompt[]> {
    try {
      const files = await fs.readdir(this.baseDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      const prompts: Prompt[] = [];
      
      for (const file of jsonFiles) {
        try {
          const filePath = path.join(this.baseDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const prompt = JSON.parse(content) as Prompt;
          
          // Filter by tags if provided
          if (options?.tags && options.tags.length > 0) {
            if (!prompt.tags || !options.tags.some(tag => prompt.tags.includes(tag))) {
              continue;
            }
          }
          
          // Filter by template status if provided
          if (options?.templatesOnly !== undefined) {
            if (!!prompt.isTemplate !== options.templatesOnly) {
              continue;
            }
          }
          
          prompts.push(prompt);
        } catch (error) {
          console.error(`Error reading prompt from ${file}:`, error);
        }
      }
      
      return prompts.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error listing prompts:', error);
      throw error;
    }
  }

  async addPrompt(prompt: Prompt): Promise<void> {
    try {
      const filePath = path.join(this.baseDir, `${prompt.id}.json`);
      const content = JSON.stringify(prompt, null, 2);
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      console.error(`Error adding prompt ${prompt.id}:`, error);
      throw error;
    }
  }

  async deletePrompt(id: string): Promise<boolean> {
    try {
      const filePath = path.join(this.baseDir, `${id}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    // No resources to close for file storage
  }
} 