/**
 * Prompt Service
 * Manages prompts in the MCP Prompts server
 */

import { v4 as uuidv4 } from 'uuid';
import { 
  Prompt, 
  StorageAdapter, 
  PromptService as PromptServiceInterface, 
  ListPromptsOptions, 
  TemplateVariables,
  ApplyTemplateResult,
  TemplateVariable
} from '../core/types.js';
import { slugify, extractVariables } from '../core/utils.js';

/**
 * Service for managing prompts
 */
export class PromptService implements PromptServiceInterface {
  private storage: StorageAdapter;
  
  /**
   * Create a new prompt service
   * @param storage Storage adapter
   */
  constructor(storage: StorageAdapter) {
    this.storage = storage;
  }
  
  /**
   * Get a prompt by ID
   * @param id Prompt ID
   * @returns The prompt
   */
  async getPrompt(id: string): Promise<Prompt> {
    return this.storage.getPrompt(id);
  }
  
  /**
   * Add a new prompt
   * @param data Partial prompt data
   * @returns The created prompt
   */
  async addPrompt(data: Partial<Prompt>): Promise<Prompt> {
    if (!data.content) {
      throw new Error('Prompt content is required');
    }
    
    const now = new Date().toISOString();
    
    // Generate ID from name or use UUID
    const id = data.id || (data.name ? slugify(data.name) : uuidv4());
    
    // Create the prompt object
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
    
    // Extract variables from content if this is a template
    if (prompt.isTemplate) {
      if (data.variables) {
        prompt.variables = data.variables;
      } else {
        const extractedVars = extractVariables(prompt.content);
        prompt.variables = extractedVars.map(name => ({
          name,
          description: '',
          required: true
        }));
      }
    }
    
    // Save to storage
    await this.storage.savePrompt(prompt);
    
    return prompt;
  }
  
  /**
   * Update an existing prompt
   * @param id Prompt ID
   * @param data Updated prompt data
   * @returns The updated prompt
   */
  async updatePrompt(id: string, data: Partial<Prompt>): Promise<Prompt> {
    // Get the existing prompt
    const existing = await this.storage.getPrompt(id);
    
    // Update the prompt
    const updated: Prompt = {
      ...existing,
      ...data,
      id: existing.id, // ID cannot be changed
      updatedAt: new Date().toISOString(),
      version: (existing.version || 0) + 1
    };
    
    // Extract variables if content changed and this is a template
    if (updated.isTemplate && data.content) {
      if (data.variables) {
        updated.variables = data.variables;
      } else {
        const extractedVars = extractVariables(updated.content);
        updated.variables = extractedVars.map(name => ({
          name,
          description: '',
          required: true
        }));
      }
    }
    
    // Save the updated prompt
    await this.storage.savePrompt(updated);
    
    return updated;
  }
  
  /**
   * List prompts with optional filtering
   * @param options Filter options
   * @returns Filtered list of prompts
   */
  async listPrompts(options?: ListPromptsOptions): Promise<Prompt[]> {
    return this.storage.listPrompts(options);
  }
  
  /**
   * Delete a prompt
   * @param id Prompt ID
   */
  async deletePrompt(id: string): Promise<void> {
    await this.storage.deletePrompt(id);
  }
  
  /**
   * Apply a template
   * @param id Template ID
   * @param variables Variables to apply
   * @returns The applied template result
   */
  async applyTemplate(id: string, variables: TemplateVariables): Promise<ApplyTemplateResult> {
    // Get the prompt
    const prompt = await this.storage.getPrompt(id);
    
    // Ensure this is a template
    if (!prompt.isTemplate) {
      throw new Error('Prompt is not a template');
    }
    
    // Get the variables from the template
    let templateVarNames: string[] = [];
    if (prompt.variables) {
      templateVarNames = prompt.variables.map(v => v.name);
    } else {
      templateVarNames = extractVariables(prompt.content);
    }
    
    // Find missing variables
    const missingVariables = templateVarNames.filter(v => !variables[v]);
    
    // Apply the variables to the content
    let content = prompt.content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
      content = content.replace(regex, String(value));
    }
    
    // Return the result
    return {
      content,
      originalPrompt: prompt,
      appliedVariables: variables,
      missingVariables: missingVariables.length > 0 ? missingVariables : undefined
    };
  }
} 