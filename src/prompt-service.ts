/**
 * Prompt Service
 * Centralizes management of all prompt-related operations
 */

import type { StorageAdapter } from './interfaces.js';
import type { ApplyTemplateResult, Prompt } from './interfaces.js';
import type { CreatePromptArgs, ListPromptsArgs, UpdatePromptArgs } from './prompts.js';
import { defaultPrompts } from './prompts.js';

export class PromptService {
  private storage: StorageAdapter;

  public constructor(storage: StorageAdapter) {
    this.storage = storage;
  }

  public async initialize() {
    await this.storage.connect();

    // Load default prompts if storage is empty
    const existingPrompts = await this.listPrompts({});
    if (existingPrompts.length === 0) {
      await Promise.all(
        Object.values(defaultPrompts).map(prompt => this.createPrompt(prompt as CreatePromptArgs)),
      );
    }
  }

  /**
   * Validate a prompt for required fields, duplicate IDs, variable consistency, and content format
   * Throws an error with details if validation fails
   * @param prompt
   * @param isUpdate
   */
  private async validatePrompt(prompt: Prompt, isUpdate = false): Promise<void> {
    const errors: string[] = [];

    // Required fields
    if (!prompt.id || typeof prompt.id !== 'string' || !prompt.id.trim()) {
      errors.push('Missing or invalid required field: id');
    }
    if (!prompt.name || typeof prompt.name !== 'string' || !prompt.name.trim()) {
      errors.push('Missing or invalid required field: name');
    }
    if (!prompt.content || typeof prompt.content !== 'string' || !prompt.content.trim()) {
      errors.push('Missing or invalid required field: content');
    }
    if (
      !prompt.createdAt ||
      typeof prompt.createdAt !== 'string' ||
      isNaN(Date.parse(prompt.createdAt))
    ) {
      errors.push('Missing or invalid required field: createdAt (must be ISO date string)');
    }
    if (
      !prompt.updatedAt ||
      typeof prompt.updatedAt !== 'string' ||
      isNaN(Date.parse(prompt.updatedAt))
    ) {
      errors.push('Missing or invalid required field: updatedAt (must be ISO date string)');
    }
    if (typeof prompt.version !== 'number' || !Number.isFinite(prompt.version)) {
      errors.push('Missing or invalid required field: version (must be a number)');
    }

    // Duplicate ID check (on create)
    if (!isUpdate) {
      const allPrompts = await this.storage.listPrompts();
      if (allPrompts.some(p => p.id === prompt.id)) {
        errors.push(`Duplicate prompt ID: '${prompt.id}'`);
      }
    }

    // Variable consistency (for templates)
    if (prompt.isTemplate) {
      const contentVars = Array.from(
        new Set(
          (prompt.content.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g) || []).map(v =>
            v.replace(/{{\s*|\s*}}/g, ''),
          ),
        ),
      );
      const declaredVars = Array.isArray(prompt.variables)
        ? prompt.variables.map(v => (typeof v === 'string' ? v : v.name))
        : [];
      // All referenced must be declared
      const missing = contentVars.filter(v => !declaredVars.includes(v));
      if (missing.length) {
        errors.push(`Variables used in content but not declared: ${missing.join(', ')}`);
      }
      // All declared must be used
      const unused = declaredVars.filter(v => !contentVars.includes(v));
      if (unused.length) {
        errors.push(`Variables declared but not used in content: ${unused.join(', ')}`);
      }
    }

    // Content format: no empty/whitespace-only content
    if (!prompt.content || !prompt.content.trim()) {
      errors.push('Prompt content is empty or whitespace only');
    }
    // Sanitization: remove trailing spaces, normalize line endings
    prompt.content = prompt.content.replace(/[ \t]+$/gm, '').replace(/\r\n?/g, '\n');

    if (errors.length) {
      const error = new Error('Prompt validation failed');
      (error as any).details = errors;
      throw error;
    }
  }

  public async createPrompt(args: CreatePromptArgs): Promise<Prompt> {
    const prompt: Prompt = {
      id: args.name.toLowerCase().replace(/\s+/g, '-'),
      ...args,
      createdAt: args.createdAt ?? new Date().toISOString(),
      updatedAt: args.updatedAt ?? new Date().toISOString(),
      version: args.version ?? 1,
    };
    await this.validatePrompt(prompt, false);
    return this.storage.savePrompt(prompt);
  }

  public async updatePrompt(id: string, args: Partial<UpdatePromptArgs>): Promise<Prompt> {
    const existing = await this.storage.getPrompt(id);
    if (!existing) {
      throw new Error(`Prompt not found: ${id}`);
    }
    const updated: Prompt = {
      ...existing,
      ...args,
      id, // Preserve original ID
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1,
    };
    await this.validatePrompt(updated, true);
    return this.storage.updatePrompt(id, updated);
  }

  public async deletePrompt(id: string): Promise<void> {
    await this.storage.deletePrompt(id);
  }

  public async getPrompt(id: string): Promise<Prompt | null> {
    return this.storage.getPrompt(id);
  }

  public async listPrompts(args: ListPromptsArgs): Promise<Prompt[]> {
    const prompts = await this.storage.listPrompts();

    return prompts.filter(prompt => {
      if (args.category && prompt.category !== args.category) {
        return false;
      }
      if (args.tag && !prompt.tags?.includes(args.tag)) {
        return false;
      }
      if (args.isTemplate !== undefined && prompt.isTemplate !== args.isTemplate) {
        return false;
      }
      return true;
    });
  }

  public async applyTemplate(
    id: string,
    variables: Record<string, string>,
  ): Promise<ApplyTemplateResult> {
    const prompt = await this.getPrompt(id);
    if (!prompt) {
      throw new Error(`Template prompt not found: ${id}`);
    }
    if (!prompt.isTemplate) {
      throw new Error(`Prompt is not a template: ${id}`);
    }

    let content = prompt.content;
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    // Check for any remaining template variables
    const remaining = content.match(/{{[^}]+}}/g);
    const missingVariables = remaining
      ? remaining.map(v => v.replace(/{{|}}/g, '').trim())
      : undefined;

    return {
      appliedVariables: variables,
      content,
      missingVariables,
      originalPrompt: prompt,
    };
  }

  /**
   * Format a prompt according to the MCP prompts/get protocol
   * @param prompt The prompt to format
   * @param variables Optional variables to apply for templates
   * @returns Formatted prompt for MCP protocol
   */
  public formatMcpPrompt(
    prompt: Prompt,
    variables?: Record<string, string>,
  ): {
    description: string;
    messages: Array<{
      role: string;
      content: {
        type: string;
        text: string;
      };
    }>;
  } {
    // Apply template variables if provided and this is a template
    let content = prompt.content;
    if (prompt.isTemplate && variables) {
      content = this.processTemplate(content, variables);
    }

    return {
      description: prompt.description || '',
      messages: [
        {
          content: {
            text: content,
            type: 'text',
          },
          role: 'system',
        },
      ],
    };
  }

  /**
   * Format a list of prompts according to the MCP prompts/list protocol
   * @param prompts Array of prompts to format
   * @returns Formatted prompts list for MCP protocol
   */
  public formatMcpPromptsList(prompts: Prompt[]): {
    prompts: Array<{
      name: string;
      description: string;
      arguments?: Array<{
        name: string;
        description?: string;
        required?: boolean;
      }>;
    }>;
  } {
    return {
      prompts: prompts.map(prompt => {
        // For template prompts, extract variables information
        const args =
          prompt.isTemplate && prompt.variables?.length
            ? prompt.variables.map((variable: any) => {
                // Handle both string variables and complex variable objects
                if (typeof variable === 'string') {
                  return { name: variable };
                } else {
                  return {
                    description: variable.description,
                    name: variable.name,
                    required: variable.required,
                  };
                }
              })
            : undefined;

        return {
          description: prompt.description || '',
          name: prompt.id,
          ...(args && { arguments: args }),
        };
      }),
    };
  }

  /**
   * Process a template string by replacing variables
   * @param template Template string
   * @param variables Variables to replace
   * @returns Processed string
   */
  private processTemplate(template: string, variables: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{${key}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  // Alias for interface compatibility
  public async addPrompt(data: Partial<Prompt>): Promise<Prompt> {
    return this.createPrompt(data as any);
  }
}
