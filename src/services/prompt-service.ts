import { v4 as uuidv4 } from 'uuid';
import { 
  Prompt, 
  StorageAdapter, 
  PromptService as PromptServiceInterface,
  ListPromptsOptions,
  TemplateVariables,
  ApplyTemplateResult
} from '../core/types';
import { extractVariables, slugify } from '../core/utils';

/**
 * Service for managing prompts
 */
export class PromptService implements PromptServiceInterface {
  /**
   * Create a new PromptService
   * @param storage Storage adapter for persistence
   */
  constructor(private storage: StorageAdapter) {}
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns Promise resolving to the prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    return this.storage.getPrompt(id);
  }
  
  /**
   * Add a new prompt
   * @param data Partial prompt data
   * @returns Promise resolving to the created prompt
   */
  async addPrompt(data: Partial<Prompt>): Promise<Prompt> {
    if (!data.content) {
      throw new Error('Content is required');
    }
    
    const now = new Date().toISOString();
    const id = data.id || slugify(data.name || '') || uuidv4();
    
    const prompt: Prompt = {
      id,
      name: data.name || id,
      description: data.description,
      content: data.content,
      isTemplate: data.isTemplate || false,
      tags: data.tags || [],
      category: data.category,
      createdAt: now,
      updatedAt: now,
      version: 1
    };
    
    // Auto-extract variables from template content
    if (prompt.isTemplate) {
      prompt.variables = data.variables || extractVariables(prompt.content);
    }
    
    await this.storage.savePrompt(prompt);
    return prompt;
  }
  
  /**
   * Update an existing prompt
   * @param id ID of the prompt to update
   * @param data Updated prompt data
   * @returns Promise resolving to the updated prompt
   */
  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt> {
    const existing = await this.storage.getPrompt(id);
    
    const updated: Prompt = {
      ...existing,
      ...data,
      id: existing.id, // ID cannot be changed
      updatedAt: new Date().toISOString(),
      version: existing.version + 1
    };
    
    // Auto-update variables if content changed and it's a template
    if (updated.isTemplate && data.content) {
      updated.variables = data.variables || extractVariables(updated.content);
    }
    
    await this.storage.savePrompt(updated);
    return updated;
  }
  
  /**
   * List prompts with optional filtering
   * @param options Filtering and pagination options
   * @returns Promise resolving to an array of prompts
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    return this.storage.listPrompts(options);
  }
  
  /**
   * Delete a prompt by ID
   * @param id Prompt ID to delete
   */
  async deletePrompt(id: string): Promise<void> {
    await this.storage.deletePrompt(id);
  }
  
  /**
   * Apply a template by substituting variables
   * @param id ID of the template prompt
   * @param variables Variables to substitute in the template
   * @returns Promise resolving to the applied template result
   */
  async applyTemplate(id: string, variables: TemplateVariables): Promise<ApplyTemplateResult> {
    const prompt = await this.storage.getPrompt(id);
    
    if (!prompt.isTemplate) {
      throw new Error('Prompt is not a template');
    }
    
    // Get or extract variables
    const templateVariables = prompt.variables || extractVariables(prompt.content);
    
    // Find missing variables
    const missingVariables = templateVariables.filter(v => !variables[v]);
    
    // Substitute variables
    let content = prompt.content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      content = content.replace(regex, String(value));
    }
    
    return {
      content,
      originalPrompt: prompt,
      appliedVariables: variables,
      missingVariables: missingVariables.length > 0 ? missingVariables : undefined
    };
  }
} 