/**
 * Prompt Service
 * Centralizes management of all prompt-related operations
 */

import Handlebars from 'handlebars';

import type { StorageAdapter } from './interfaces.js';
import type { ApplyTemplateResult, Prompt } from './interfaces.js';
import type { CreatePromptArgs, ListPromptsArgs, UpdatePromptArgs } from './prompts.js';
import { defaultPrompts, promptSchemas } from './prompts.js';
import { DuplicateError, AppError } from './errors.js';
import { getRedisClient, jsonFriendlyErrorReplacer } from './utils.js';
import { config } from './config.js';

const templateHelpers: { [key: string]: (...args: any[]) => any } = {
  toUpperCase: (str: string) => str.toUpperCase(),
  toLowerCase: (str: string) => str.toLowerCase(),
  jsonStringify: (obj: any) => JSON.stringify(obj, jsonFriendlyErrorReplacer, 2),
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

  /**
   * Create a new prompt (version 1 or specified version). Throws if (id, version) exists.
   */
  public async createPrompt(args: CreatePromptArgs): Promise<Prompt> {
    const parseResult = promptSchemas.create.safeParse(args);
    if (!parseResult.success) {
      throw new AppError(
        'Invalid prompt data',
        400,
        'VALIDATION_ERROR',
        parseResult.error.issues,
      );
    }

    const { name, version: inputVersion } = parseResult.data;

    const id = name.toLowerCase().replace(/\s+/g, '-');
    const version = inputVersion ?? 1;
    // Check for duplicate prompt ID/version
    const existing = await this.storage.getPrompt(id, version);
    if (existing) {
      throw new DuplicateError(`Prompt with id '${id}' and version '${version}' already exists.`);
    }
    const prompt: Prompt = {
      ...parseResult.data,
      id,
      createdAt: args.createdAt ?? new Date().toISOString(),
      updatedAt: args.updatedAt ?? new Date().toISOString(),
      version,
    };

    // Template variable validation
    if (prompt.isTemplate && prompt.variables && prompt.content) {
      // Extract variables from template content
      const variablePattern = /{{\s*([\w.]+)\s*}}/g;
      const foundVars = new Set<string>();
      let match;
      while ((match = variablePattern.exec(prompt.content)) !== null) {
        foundVars.add(match[1]);
      }
      const declaredVars = Array.isArray(prompt.variables)
        ? prompt.variables.map(v =>
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
        throw new AppError(
          `Template variable mismatch: missing in declared: [${missingInDeclared.join(', ')}], extra in declared: [${extraInDeclared.join(', ')}]`,
          400,
          'VALIDATION_ERROR',
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

    const result = await this.storage.savePrompt(prompt);
    await this.invalidatePromptCache(result.id);
    return result;
  }

  /**
   * Get a prompt by ID and version (latest if not specified).
   */
  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    return this.storage.getPrompt(id, version);
  }

  /**
   * Update a specific version of a prompt. Throws if not found.
   */
  public async updatePrompt(
    id: string,
    version: number,
    args: Partial<UpdatePromptArgs>,
  ): Promise<Prompt> {
    const existing = await this.storage.getPrompt(id, version);
    if (!existing) {
      throw new AppError(`Prompt not found: ${id} v${version}`, 404, 'NOT_FOUND');
    }
    const updated: Prompt = {
      ...existing,
      ...args,
      id, // Preserve original ID
      version, // Preserve version
      updatedAt: new Date().toISOString(),
    };
    const result = await this.storage.updatePrompt(id, version, updated);
    await this.invalidatePromptCache(id);
    return result;
  }

  /**
   * Delete a specific version of a prompt, or all versions if version is omitted.
   */
  public async deletePrompt(id: string, version?: number): Promise<void> {
    await this.storage.deletePrompt(id, version);
    await this.invalidatePromptCache(id);
  }

  /**
   * List prompts (latest version only by default, or all versions if specified).
   */
  public async listPrompts(args: ListPromptsArgs, allVersions = false): Promise<Prompt[]> {
    return this.storage.listPrompts(args, allVersions);
  }

  /**
   * List all versions for a prompt ID.
   */
  public async listPromptVersions(id: string): Promise<number[]> {
    return this.storage.listPromptVersions(id);
  }

  /**
   * Apply a template prompt by ID and version (latest if not specified).
   */
  public async applyTemplate(
    id: string,
    variables: Record<string, any>,
    version?: number,
  ): Promise<ApplyTemplateResult> {
    const prompt = await this.getPrompt(id, version);
    if (!prompt) {
      throw new AppError(`Template prompt not found: ${id} v${version ?? 'latest'}`, 404, 'NOT_FOUND');
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

  /**
   * Bulk create prompts. Returns an array of results (success or error per prompt).
   */
  public async createPromptsBulk(
    argsArray: CreatePromptArgs[],
  ): Promise<Array<{ success: boolean; id?: string; error?: string }>> {
    const results: Array<{ success: boolean; id?: string; error?: string }> = [];
    for (const args of argsArray) {
      try {
        const prompt = await this.createPrompt(args);
        results.push({ success: true, id: prompt.id });
      } catch (err: any) {
        results.push({ success: false, error: err?.message || 'Unknown error' });
      }
    }
    return results;
  }

  /**
   * Bulk delete prompts. Returns an array of results (success or error per id).
   */
  public async deletePromptsBulk(
    ids: string[],
  ): Promise<Array<{ success: boolean; id: string; error?: string }>> {
    const results: Array<{ success: boolean; id: string; error?: string }> = [];
    for (const id of ids) {
      try {
        await this.deletePrompt(id);
        results.push({ success: true, id });
      } catch (err: any) {
        results.push({ success: false, id, error: err?.message || 'Unknown error' });
      }
    }
    return results;
  }

  /**
   * Invalidate prompt and prompt list caches after mutation.
   */
  private async invalidatePromptCache(id?: string) {
    const redis = getRedisClient();
    if (!redis) return;
    if (id) await redis.del(`prompt:${id}`);
    // Invalidate all promptlist caches (wildcard)
    const keys = await redis.keys('promptlist:*');
    if (keys.length) await redis.del(...keys);
  }
}
