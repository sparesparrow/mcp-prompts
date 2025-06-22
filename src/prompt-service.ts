/**
 * Prompt Service
 * Centralizes management of all prompt-related operations
 */

import Handlebars from 'handlebars';
import { z } from 'zod';

import { config } from './config.js';
import { AppError, DuplicateError, NotFoundError, ValidationError } from './errors.js';
import type { StorageAdapter, ApplyTemplateResult, Prompt, CreatePromptArgs, ListPromptsArgs, UpdatePromptArgs } from './interfaces.js';
import * as Prompts from './prompts.js';
import { promptSchemas } from './schemas.js';
import { getRedisClient, jsonFriendlyErrorReplacer } from './utils.js';

// Derive types from the single source of truth
type CreatePromptArgs = z.infer<typeof promptSchemas.create>;
type UpdatePromptArgs = z.infer<typeof promptSchemas.update>;
type ListPromptsArgs = z.infer<typeof promptSchemas.list>;

const templateHelpers: { [key: string]: (...args: any[]) => any } = {
  eq: (a: any, b: any) => a === b,
  join: (arr: any[], sep = ', ') => arr.join(sep),
  jsonStringify: (obj: any) => JSON.stringify(obj, jsonFriendlyErrorReplacer, 2),
  toLowerCase: (str: string) => str.toLowerCase(),
  toUpperCase: (str: string) => str.toUpperCase(),
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
        Object.values(Prompts.defaultPrompts).map(prompt =>
          this.createPrompt(prompt as CreatePromptArgs),
        ),
      );
    }
  }

  /**
   * Create a new prompt (version 1 or specified version). Throws if (id, version) exists.
   * @param args
   */
  public async createPrompt(args: CreatePromptArgs): Promise<Prompt> {
    const parseResult = promptSchemas.create.safeParse(args);
    if (!parseResult.success) {
      throw new ValidationError('Invalid prompt data', parseResult.error.issues);
    }

    const { name } = parseResult.data;

    const id = name.toLowerCase().replace(/\s+/g, '-');
    const version = 1;
    // Check for duplicate prompt ID/version
    const existing = await this.storage.getPrompt(id, version);
    if (existing) {
      throw new DuplicateError(`Prompt with id '${id}' and version '${version}' already exists.`);
    }
    const prompt: Prompt = {
      ...(parseResult.data as any),
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
        throw new ValidationError(
          `Template variable mismatch: missing in declared: [${missingInDeclared.join(', ')}], extra in declared: [${extraInDeclared.join(', ')}]`,
          [
            ...(missingInDeclared.length > 0
              ? [
                  {
                    code: 'custom' as const,
                    message: `Missing variables: ${missingInDeclared.join(', ')}`,
                    path: ['variables'] as (string | number)[],
                  },
                ]
              : []),
            ...(extraInDeclared.length > 0
              ? [
                  {
                    code: 'custom' as const,
                    message: `Extra variables: ${extraInDeclared.join(', ')}`,
                    path: ['variables'] as (string | number)[],
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
   * @param id
   * @param version
   */
  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    return this.storage.getPrompt(id, version);
  }

  /**
   * Update a specific version of a prompt. Throws if not found.
   * @param id
   * @param version
   * @param args
   */
  public async updatePrompt(
    id: string,
    version: number,
    args: Partial<UpdatePromptArgs>,
  ): Promise<Prompt> {
    const existing = await this.storage.getPrompt(id, version);
    if (!existing) {
      throw new NotFoundError(`Prompt not found: ${id} v${version}`);
    }
    const updated: Prompt = {
      ...(existing as any),
      ...args,
      id,
      // Preserve version
      updatedAt: new Date().toISOString(),
      // Preserve original ID
      version,
    };
    const result = await this.storage.updatePrompt(id, version, updated);
    await this.invalidatePromptCache(id);
    return result;
  }

  /**
   * Delete a specific version of a prompt, or all versions if version is omitted.
   * Returns true if a deletion occurred, false otherwise.
   */
  public async deletePrompt(id: string, version?: number): Promise<boolean> {
    const deleted = await this.storage.deletePrompt(id, version);
    if (deleted) {
      await this.invalidatePromptCache(id);
    }
    return deleted;
  }

  /**
   * List prompts (latest version only by default, or all versions if specified).
   * @param args
   * @param allVersions
   */
  public async listPrompts(args: ListPromptsArgs, allVersions = false): Promise<Prompt[]> {
    return this.storage.listPrompts(args, allVersions);
  }

  /**
   * List all versions for a prompt ID.
   * @param id
   */
  public async listPromptVersions(id: string): Promise<number[]> {
    return this.storage.listPromptVersions(id);
  }

  /**
   * Apply a template prompt by ID and version (latest if not specified).
   * @param id
   * @param variables
   * @param version
   */
  public async applyTemplate(
    id: string,
    variables: Record<string, any>,
    version?: number,
  ): Promise<ApplyTemplateResult> {
    const prompt = await this.getPrompt(id, version);
    if (!prompt) {
      throw new NotFoundError(`Template prompt not found: ${id} v${version ?? 'latest'}`);
    }
    if (!prompt.isTemplate) {
      throw new AppError(`Prompt is not a template: ${id}`, 400);
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
   * @param argsArray
   */
  public async createPromptsBulk(
    argsArray: CreatePromptArgs[],
  ): Promise<Array<{ success: boolean; id?: string; error?: string }>> {
    const results: Array<{ success: boolean; id?: string; error?: string }> = [];
    for (const args of argsArray) {
      try {
        const prompt = await this.createPrompt(args);
        results.push({ id: prompt.id, success: true });
      } catch (err: any) {
        results.push({ error: err?.message || 'Unknown error', success: false });
      }
    }
    return results;
  }

  /**
   * Bulk delete prompts. Returns an array of results (success or error per id).
   * @param ids
   */
  public async deletePromptsBulk(
    ids: string[],
  ): Promise<Array<{ success: boolean; id: string; error?: string }>> {
    const results: Array<{ success: boolean; id: string; error?: string }> = [];
    for (const id of ids) {
      try {
        const deleted = await this.deletePrompt(id);
        if (deleted) {
          results.push({ success: true, id });
        } else {
          results.push({ success: false, id, error: 'Prompt not found' });
        }
      } catch (err: any) {
        results.push({ error: err?.message || 'Unknown error', id, success: false });
      }
    }
    return results;
  }

  /**
   * Invalidate prompt and prompt list caches after mutation.
   * @param id
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