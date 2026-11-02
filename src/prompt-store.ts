import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils.js';

// Shared by the MCP stdio server and the HTTP server, so both serve the same prompts the same way.

// The package root (dist/..), not the cwd: MCP clients start the server from the user's project.
const PACKAGE_ROOT = path.join(__dirname, '..');

export const PromptSchema = z.object({
  id: z.string(),
  name: z.string(),
  content: z.string(),
  isTemplate: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  variables: z.array(z.union([
    z.string(),
    z.object({
      name: z.string(),
      description: z.string().optional(),
      required: z.boolean().default(true),
      type: z.enum(['string', 'number', 'boolean']).default('string')
    })
  ])).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export const CreatePromptParams = PromptSchema.omit({ id: true });
// zod 4 applies .default() values inside .partial(), which would reset isTemplate and tags on every
// update that leaves them out; updates override those two fields without defaults.
export const UpdatePromptParams = PromptSchema.partial().omit({ id: true }).extend({
  isTemplate: z.boolean().optional(),
  tags: z.array(z.string()).optional()
});

export type CreatePromptInput = z.infer<typeof CreatePromptParams>;
export type UpdatePromptInput = z.infer<typeof UpdatePromptParams>;

export interface StoredPrompt extends CreatePromptInput {
  id: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  [key: string]: unknown;
}

export interface PromptSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isTemplate: boolean;
  createdAt: string;
  version: number;
}

export interface PromptStats {
  total: number;
  templates: number;
  regular: number;
  tags: string[];
  categories: string[];
}

/** A prompt lookup or operation failed because the prompt does not exist. */
export class PromptNotFoundError extends Error {
  constructor(id: string) {
    super(`Prompt with ID ${id} not found`);
  }
}

/** The prompt exists but cannot be used as asked (e.g. applying a non-template). */
export class PromptUsageError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class PromptStore {
  private readonly prompts = new Map<string, StoredPrompt>();

  get size(): number {
    return this.prompts.size;
  }

  /** Loads prompts from PROMPTS_DIR (or the data/prompts shipped with the package), falling back to data/sample-prompts.json. */
  loadDefault(): void {
    try {
      const promptsDir = process.env.PROMPTS_DIR || path.join(PACKAGE_ROOT, 'data', 'prompts');
      if (fs.existsSync(promptsDir)) {
        const totalLoaded = this.loadDirectory(promptsDir);
        logger.info(`Loaded ${totalLoaded} prompts from directory structure`);
        return;
      }
      const sampleDataPath = path.join(PACKAGE_ROOT, 'data', 'sample-prompts.json');
      if (fs.existsSync(sampleDataPath)) {
        const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
        const now = new Date().toISOString();
        for (const prompt of sampleData.prompts) {
          this.prompts.set(prompt.id, { ...prompt, createdAt: now, updatedAt: now, version: 1 });
        }
        logger.info(`Loaded ${sampleData.prompts.length} sample prompts`);
      }
    } catch (error) {
      logger.warn('Could not load prompts:', error);
    }
  }

  /** Recursively loads every *.json prompt under dir (index.json excluded). Returns how many loaded. */
  loadDirectory(dir: string): number {
    let count = 0;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          count += this.loadDirectory(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
          try {
            const promptData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            this.prompts.set(promptData.id, {
              ...promptData,
              createdAt: promptData.createdAt || new Date().toISOString(),
              updatedAt: promptData.updatedAt || new Date().toISOString(),
              version: promptData.version || 1
            });
            count++;
          } catch (err) {
            logger.warn(`Failed to load prompt from ${fullPath}:`, err);
          }
        }
      }
    } catch (err) {
      logger.warn(`Failed to read directory ${dir}:`, err);
    }
    return count;
  }

  /** Prompts carrying any of the tags and containing the search text (name or content). */
  list(filter: { tags?: string[]; search?: string } = {}): PromptSummary[] {
    let promptList = Array.from(this.prompts.values());
    if (filter.tags && filter.tags.length > 0) {
      promptList = promptList.filter(prompt => filter.tags!.some(tag => (prompt.tags ?? []).includes(tag)));
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      promptList = promptList.filter(prompt =>
        prompt.name.toLowerCase().includes(searchLower) ||
        prompt.content.toLowerCase().includes(searchLower)
      );
    }
    return promptList.map(prompt => ({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description || 'No description',
      tags: prompt.tags ?? [],
      isTemplate: prompt.isTemplate || false,
      createdAt: prompt.createdAt,
      version: prompt.version
    }));
  }

  get(id: string): StoredPrompt {
    const prompt = this.prompts.get(id);
    if (!prompt) throw new PromptNotFoundError(id);
    return prompt;
  }

  add(input: CreatePromptInput): StoredPrompt {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const now = new Date().toISOString();
    const prompt: StoredPrompt = { ...input, id, createdAt: now, updatedAt: now, version: 1 };
    this.prompts.set(id, prompt);
    logger.info(`Added prompt: ${id}`);
    return prompt;
  }

  update(id: string, updates: UpdatePromptInput): StoredPrompt {
    const prompt = this.get(id);
    const updated: StoredPrompt = {
      ...prompt,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
      version: prompt.version + 1
    };
    this.prompts.set(id, updated);
    logger.info(`Updated prompt: ${id}`);
    return updated;
  }

  delete(id: string): StoredPrompt {
    const prompt = this.get(id);
    this.prompts.delete(id);
    logger.info(`Deleted prompt: ${id}`);
    return prompt;
  }

  /** Fills {{name}} placeholders of a template prompt. */
  applyTemplate(id: string, variables: Record<string, unknown>): string {
    const prompt = this.get(id);
    if (!prompt.isTemplate) {
      throw new PromptUsageError(`Prompt "${prompt.name}" is not a template`);
    }
    let result = prompt.content;
    for (const [key, value] of Object.entries(variables)) {
      // split/join instead of a RegExp built from the key, so names with regex characters are literal
      result = result.split(`{{${key}}}`).join(String(value));
    }
    return result;
  }

  stats(): PromptStats {
    const promptList = Array.from(this.prompts.values());
    return {
      total: promptList.length,
      templates: promptList.filter(p => p.isTemplate).length,
      regular: promptList.filter(p => !p.isTemplate).length,
      tags: Array.from(new Set(promptList.flatMap(p => p.tags || []))),
      categories: Array.from(new Set(
        promptList.map(p => (p.metadata as Record<string, unknown> | undefined)?.category).filter(Boolean)
      )) as string[]
    };
  }
}
