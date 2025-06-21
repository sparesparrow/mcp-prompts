/**
 * Prompt Service
 * Centralizes management of all prompt-related operations
 */

import Handlebars from 'handlebars';

import type { StorageAdapter } from './interfaces.js';
import type { ApplyTemplateResult, Prompt } from './interfaces.js';
import type { CreatePromptArgs, ListPromptsArgs, UpdatePromptArgs } from './prompts.js';
import { defaultPrompts } from './prompts.js';
import { ValidationError } from './validation.js';

const templateHelpers: { [key: string]: (...args: any[]) => any } = {
  toUpperCase: (str: string) => str.toUpperCase(),
  toLowerCase: (str: string) => str.toLowerCase(),
  jsonStringify: (obj: any) => JSON.stringify(obj, null, 2),
  join: (arr: any[], sep = ', ') => arr.join(sep),
  eq: (a: any, b: any) => a === b,
};

export class PromptService {
  private storage: StorageAdapter;

  public constructor(storage: StorageAdapter) {
    this.storage = storage;
    this.initializeTemplateEngine();
  }

  private initializeTemplateEngine() {
    for (const key in templateHelpers) {
      if (Object.prototype.hasOwnProperty.call(templateHelpers, key)) {
        Handlebars.registerHelper(key, templateHelpers[key]);
      }
    }
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

  public async createPrompt(args: CreatePromptArgs): Promise<Prompt> {
    const id = args.name.toLowerCase().replace(/\s+/g, '-');
    // Check for duplicate prompt ID
    const existing = await this.storage.getPrompt(id);
    if (existing) {
      throw new ValidationError(`Prompt with id '${id}' already exists.`, []);
    }
    const prompt: Prompt = {
      id,
      ...args,
      createdAt: args.createdAt ?? new Date().toISOString(),
      updatedAt: args.updatedAt ?? new Date().toISOString(),
      version: args.version ?? 1,
    };

    // Template variable validation
    if (args.isTemplate && args.variables && args.content) {
      // Extract variables from template content
      const variablePattern = /{{\s*([\w.]+)\s*}}/g;
      const foundVars = new Set<string>();
      let match;
      while ((match = variablePattern.exec(args.content)) !== null) {
        foundVars.add(match[1]);
      }
      const declaredVars = Array.isArray(args.variables)
        ? args.variables.map(v =>
            typeof v === 'string'
              ? v
              : typeof v === 'object' && v !== null && 'name' in v
                ? (v as { name: string }).name
                : '',
          )
        : [];
      const missingInDeclared = Array.from(foundVars).filter(v => !declaredVars.includes(v));
      const extraInDeclared = declaredVars.filter(v => !foundVars.has(v));
      if (missingInDeclared.length > 0 || extraInDeclared.length > 0) {
        throw new ValidationError(
          `Template variable mismatch: missing in declared: [${missingInDeclared.join(', ')}], extra in declared: [${extraInDeclared.join(', ')}]`,
          [
            ...(missingInDeclared.length > 0
              ? [
                  {
                    code: 'custom' as const,
                    path: ['variables'] as (string | number)[],
                    message: `Missing variables: ${missingInDeclared.join(', ')}`,
                  },
                ]
              : []),
            ...(extraInDeclared.length > 0
              ? [
                  {
                    code: 'custom' as const,
                    path: ['variables'] as (string | number)[],
                    message: `Extra variables: ${extraInDeclared.join(', ')}`,
                  },
                ]
              : []),
          ].flat(),
        );
      }
    }

    return this.storage.savePrompt(prompt);
  }

  public async updatePrompt(id: string, args: Partial<UpdatePromptArgs>): Promise<Prompt> {
    const existing = await this.storage.getPrompt(id);
    if (!existing) {
      throw new ValidationError(`Prompt not found: ${id}`, []);
    }
    const updated: Prompt = {
      ...existing,
      ...args,
      id, // Preserve original ID
      updatedAt: new Date().toISOString(),
      version: (existing.version || 1) + 1,
    };
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
    variables: Record<string, any>,
  ): Promise<ApplyTemplateResult> {
    const prompt = await this.getPrompt(id);
    if (!prompt) {
      throw new ValidationError(`Template prompt not found: ${id}`, []);
    }
    if (!prompt.isTemplate) {
      throw new Error(`Prompt is not a template: ${id}`);
    }

    const content = this.processTemplate(prompt.content, variables);

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

  private processTemplate(template: string, variables: Record<string, any>): string {
    const compiled = Handlebars.compile(template);
    return compiled(variables);
  }

  // Alias for interface compatibility
  public async addPrompt(data: Partial<Prompt>): Promise<Prompt> {
    return this.createPrompt(data as any);
  }

  public getStorage(): StorageAdapter {
    return this.storage;
  }
}
