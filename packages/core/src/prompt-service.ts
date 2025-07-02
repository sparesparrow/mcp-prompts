import Handlebars from 'handlebars';
import type {
  ApplyTemplateResult,
  Prompt,
} from './types/manual-exports.js';
import { promptSchemas } from './types/manual-exports.js';

import type {
  CreatePromptParams,
  ListPromptsOptions,
  TemplateVariable,
  UpdatePromptParams,
  TemplateFormatOptions,
  IPromptRepository,
  IPromptApplication,
  ITemplatingEngine,
} from './interfaces.js';
import * as Prompts from './prompts.js';
import { DuplicateError, AppError, HttpErrorCode, ValidationError, NotFoundError } from './errors.js';
import { getRedisClient, jsonFriendlyErrorReplacer, templateHelpers } from './utils.js';
import { config } from './config.js';

function validateTemplateVariables(prompt: Pick<Prompt, 'content' | 'isTemplate' | 'variables'>) {
  if (!prompt.isTemplate) {
    if (prompt.variables && prompt.variables.length > 0) {
      throw new ValidationError('Variables can only be defined for templates.', [
        { path: ['variables'], message: 'Variables can only be defined for templates.' },
      ]);
    }
    return;
  }

  const templateVariables = new Set(
    (prompt.content.match(/{{(.*?)}}/g) || []).map((v: string) => v.replace(/{{|}}/g, '').trim()),
  );

  const declaredVariables = new Set(prompt.variables?.map((v: string | { name: string }) => (typeof v === 'string' ? v : v.name)));

  if (templateVariables.size !== declaredVariables.size) {
    throw new ValidationError(
      'The variables in the template content and the variables field do not match.',
    );
  }

  for (const v of Array.from(templateVariables)) {
    if (!declaredVariables.has(v)) {
      throw new ValidationError(
        `Variable '${v}' is used in the template but not declared in the variables field.`,
      );
    }
  }
}

function sanitizePromptMetadata<T extends { metadata?: any }>(prompt: T): T {
  if ('metadata' in prompt && prompt.metadata === null) {
    return { ...prompt, metadata: undefined };
  }
  return prompt;
}

export class PromptService implements IPromptApplication {
  private storage: IPromptRepository;
  private templatingEngine: ITemplatingEngine;
  private promptCache = new Map<string, Prompt>();

  public constructor(storage: IPromptRepository, templatingEngine: ITemplatingEngine) {
    this.storage = storage;
    this.templatingEngine = templatingEngine;
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
        Object.values(Prompts.defaultPrompts).map(prompt => this.createPrompt(prompt as CreatePromptParams)),
      );
    }
  }

  /**
   * Create a new prompt.
   * A version number will be automatically assigned.
   * If an ID is provided and it already exists, this will create a new version of that prompt.
   * If no ID is provided, a new one will be generated from the name.
   */
  public async createPrompt(promptData: CreatePromptParams): Promise<Prompt> {
    const base: Omit<Prompt, 'metadata'> = {
      id: promptData.id ?? this.generateId(promptData.name),
      name: promptData.name,
      content: promptData.content,
      isTemplate: Boolean(promptData.isTemplate),
      description: promptData.description,
      category: promptData.category,
      tags: promptData.tags,
      variables: promptData.variables,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
    const data: Prompt =
      promptData.metadata !== null && promptData.metadata !== undefined
        ? { ...base, metadata: promptData.metadata }
        : base;
    if (!data.name || !data.content) {
      throw new Error('Name and content are required fields');
    }
    const prompt = await this.storage.savePrompt(data);
    await this.invalidatePromptCache(prompt.id);
    return sanitizePromptMetadata(prompt);
  }

  private generateId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
  }

  /**
   * Get a prompt by ID. If version is not specified, gets the latest version.
   * Caches prompts for performance.
   */
  public async getPrompt(id: string, version?: number): Promise<Prompt | null> {
    const cacheKey = version ? `${id}:v${version}` : `${id}:latest`;
    if (this.promptCache.has(cacheKey)) {
      return sanitizePromptMetadata(this.promptCache.get(cacheKey)!);
    }

    const prompt = await this.storage.getPrompt(id, version);
    if (prompt) {
      this.promptCache.set(cacheKey, prompt);
      // If we fetched latest, also cache it with its specific version number
      if (!version) {
        this.promptCache.set(`${id}:v${prompt.version}`, prompt);
      }
      return sanitizePromptMetadata(prompt);
    }
    return null;
  }

  /**
   * Update a prompt. A new version is created.
   */
  public async updatePrompt(
    id: string,
    version: number,
    data: Partial<Prompt>,
  ): Promise<Prompt> {
    if ('metadata' in data && data.metadata === null) {
      delete (data as any).metadata;
    }
    const existingPrompt = await this.getPrompt(id, version);
    if (!existingPrompt) {
      throw new NotFoundError(`Prompt not found: ${id} v${version}`);
    }

    const base: Omit<Prompt, 'metadata'> = {
      ...existingPrompt,
      ...data,
      id,
      version,
      updatedAt: new Date().toISOString(),
    };
    let updatedPromptData: Prompt;
    if ('metadata' in data && data.metadata !== null && data.metadata !== undefined) {
      updatedPromptData = { ...base, metadata: data.metadata };
    } else {
      updatedPromptData = base as Prompt;
    }

    validateTemplateVariables({
      content: updatedPromptData.content,
      isTemplate: updatedPromptData.isTemplate ?? false,
      variables: updatedPromptData.variables ?? [],
    });

    const result = await this.storage.updatePrompt(id, version, updatedPromptData);
    await this.invalidatePromptCache(id);
    return sanitizePromptMetadata(result);
  }

  /**
   * Delete a specific version of a prompt, or all versions if version is omitted.
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
   */
  public async listPrompts(args: ListPromptsOptions, allVersions = false): Promise<Prompt[]> {
    const prompts = await this.storage.listPrompts(args, allVersions);
    return prompts.map(sanitizePromptMetadata);
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
    options?: TemplateFormatOptions,
  ): Promise<ApplyTemplateResult> {
    const prompt = await this.getPrompt(id, version);
    if (!prompt) {
      throw new NotFoundError(`Template prompt not found: ${id} v${version ?? 'latest'}`);
    }
    if (!prompt.isTemplate) {
      throw new Error(`Prompt is not a template: ${id}`);
    }

    try {
      // Recursively find and register partials, starting the call stack with the root prompt
      await this.registerPartialsRecursive(prompt.content, new Set(), new Set([prompt.id]));

      const content = this.processTemplate(prompt.content, variables, options);

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
    } finally {
      this.clearPartials();
    }
  }

  /**
   * Clears all registered Handlebars partials to avoid pollution between calls.
   */
  private clearPartials() {
    for (const partialName in Handlebars.partials) {
      // istanbul ignore else
      if (Object.prototype.hasOwnProperty.call(Handlebars.partials, partialName)) {
        Handlebars.unregisterPartial(partialName);
      }
    }
  }

  /**
   * Recursively finds and registers partials, detecting cycles.
   * @param templateContent The content to scan.
   * @param registeredPartials A set of already registered partials to avoid re-registering.
   * @param callStack A set representing the current recursion path to detect cycles.
   */
  private async registerPartialsRecursive(
    templateContent: string,
    registeredPartials: Set<string>,
    callStack: Set<string>
  ): Promise<void> {
    const partialRegex = /{{\s*>\s*([\w-]+)\s*}}/g;
    let match;

    // Create a list of unique partials to fetch from this template
    const partialsToScan = new Set<string>();
    while ((match = partialRegex.exec(templateContent)) !== null) {
      partialsToScan.add(match[1]);
    }

    for (const partialId of partialsToScan) {
      if (callStack.has(partialId)) {
        throw new Error(`Recursive partial detected: ${Array.from(callStack).join(' -> ')} -> ${partialId}`);
      }

      // Only process if it hasn't been registered globally yet
      if (!registeredPartials.has(partialId)) {
        const partialPrompt = await this.getPrompt(partialId);
        if (partialPrompt) {
          Handlebars.registerPartial(partialId, partialPrompt.content);
          registeredPartials.add(partialId);

          // Add to call stack for this path and recurse
          callStack.add(partialId);
          await this.registerPartialsRecursive(partialPrompt.content, registeredPartials, callStack);
          // Remove from call stack after returning from this path
          callStack.delete(partialId);
        } else {
          console.warn(`Partial prompt with id '${partialId}' not found.`);
          Handlebars.registerPartial(partialId, '');
        }
      }
    }
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

  private processTemplate(template: string, variables: Record<string, any>, options?: TemplateFormatOptions): string {
    try {
      let delimiters: [string, string] | undefined;
      if (options?.delimiterStyle) {
        switch (options.delimiterStyle) {
          case 'curly':
            delimiters = ['{', '}'];
            break;
          case 'double_curly':
            delimiters = ['{{', '}}'];
            break;
          case 'dollar':
            delimiters = ['${', '}'];
            break;
          case 'percent':
            delimiters = ['%{', '}'];
            break;
        }
      }
      const compiled = Handlebars.compile(template, {
        strict: true,
        preventIndent: true,
        ...(delimiters ? { delimiters } : {}),
      });
      return compiled(variables);
    } catch (e: any) {
      throw new Error(`Template compilation failed: ${e.message}`);
    }
  }

  // Alias for interface compatibility
  public async addPrompt(data: Partial<Prompt>): Promise<Prompt> {
    const prompt = await this.createPrompt(data as CreatePromptParams);
    return sanitizePromptMetadata(prompt);
  }

  public getStorage(): IPromptRepository {
    return this.storage;
  }

  /**
   * Bulk create prompts. Returns an array of results (success or error per prompt).
   */
  public async createPromptsBulk(
    argsArray: CreatePromptParams[],
  ): Promise<Array<{ success: boolean; id?: string; error?: string }>> {
    const results = await Promise.all(
      argsArray.map(async args => {
        try {
          const newPrompt = await this.createPrompt(args);
          return { success: true, id: newPrompt.id };
        } catch (e: any) {
          return { success: false, id: args.name, error: e.message };
        }
      }),
    );
    return results;
  }

  /**
   * Bulk delete prompts. Returns an array of results (success or error per id).
   */
  public async deletePromptsBulk(
    ids: string[],
  ): Promise<Array<{ success: boolean; id: string; error?: string }>> {
    const results = await Promise.all(
      ids.map(async id => {
        try {
          const deleted = await this.deletePrompt(id);
          if (deleted) {
            return { success: true, id };
          } else {
            return { success: false, id, error: 'Prompt not found' };
          }
        } catch (e: any) {
          return { success: false, id, error: e.message };
        }
      }),
    );
    return results;
  }

  /**
   * Invalidate prompt and prompt list caches after mutation.
   */
  private async invalidatePromptCache(id: string) {
    this.promptCache.delete(id);
    this.promptCache.delete(`${id}:latest`);
  }
}
