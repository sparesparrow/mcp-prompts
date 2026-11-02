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
  /** metadata.language, when the prompt has one, so a client can prefer a language without fetching each prompt. */
  language?: string;
}

export interface PromptStats {
  total: number;
  templates: number;
  regular: number;
  tags: string[];
  categories: string[];
  sources: Record<PromptSource, number>;
}

/** Where a prompt came from: the package (or PROMPTS_DIR), the remote catalog, the user's folders, or this session. */
export type PromptSource = 'bundled' | 'catalog' | 'user' | 'session';

export interface CatalogOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

const CATALOG_TIMEOUT_MS = 5000;
const CATALOG_MAX_BYTES = 1024 * 1024;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** https, or plain http only to this machine, so a catalog never travels unencrypted over a network. */
function catalogUrlAllowed(url: URL): boolean {
  return url.protocol === 'https:' || (url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname));
}

/** PROMPTS_EXTRA_DIRS: directories separated by the platform's path delimiter (':' or ';'). */
export function splitDirs(value: string | undefined): string[] {
  return (value ?? '').split(path.delimiter).map(dir => dir.trim()).filter(Boolean);
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
  private readonly sources = new Map<string, PromptSource>();

  get size(): number {
    return this.prompts.size;
  }

  /**
   * Loads every configured source, each overriding the one before by id: the bundled prompts (loadDefault), then
   * the catalog at PROMPTS_CATALOG_URL, then the user's own folders in PROMPTS_EXTRA_DIRS. A source that fails is
   * logged and skipped, so the bundled prompts always remain.
   */
  async loadConfigured(env: NodeJS.ProcessEnv = process.env, catalogOptions: CatalogOptions = {}): Promise<void> {
    this.loadDefault(env);
    const catalogUrl = env.PROMPTS_CATALOG_URL?.trim();
    if (catalogUrl) {
      await this.loadCatalog(catalogUrl, catalogOptions);
    }
    for (const dir of splitDirs(env.PROMPTS_EXTRA_DIRS)) {
      if (!fs.existsSync(dir)) {
        logger.warn(`PROMPTS_EXTRA_DIRS: ${dir} does not exist, skipped`);
        continue;
      }
      logger.info(`Loaded ${this.loadDirectory(dir, 'user')} prompts from ${dir}`);
    }
  }

  /**
   * Fetches a catalog: a JSON array of prompts, or { "prompts": [...] }. Each entry must match PromptSchema; the
   * others are skipped. Returns how many loaded; any failure returns 0 and leaves the store as it was.
   */
  async loadCatalog(location: string, options: CatalogOptions = {}): Promise<number> {
    const timeoutMs = options.timeoutMs ?? CATALOG_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? CATALOG_MAX_BYTES;
    try {
      const url = new URL(location);
      if (!catalogUrlAllowed(url)) {
        logger.warn(`PROMPTS_CATALOG_URL must be https (or http to localhost): ${url.origin} refused`);
        return 0;
      }
      const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      if (!catalogUrlAllowed(new URL(response.url || url.href))) {
        logger.warn(`Catalog redirected to ${response.url}, which is not https: refused`);
        return 0;
      }
      if (!response.ok) {
        logger.warn(`Catalog ${url.href} answered ${response.status}: skipped`);
        return 0;
      }
      const body = await readLimited(response, maxBytes);
      const data: unknown = JSON.parse(body);
      const entries = Array.isArray(data) ? data : (data as { prompts?: unknown } | null)?.prompts;
      if (!Array.isArray(entries)) {
        logger.warn(`Catalog ${url.href} is neither an array nor { "prompts": [...] }: skipped`);
        return 0;
      }
      const now = new Date().toISOString();
      let count = 0;
      for (const entry of entries) {
        const parsed = PromptSchema.safeParse(entry);
        if (!parsed.success) {
          logger.warn(`Catalog entry skipped: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
          continue;
        }
        const raw = entry as Record<string, unknown>;
        this.prompts.set(parsed.data.id, {
          ...parsed.data,
          ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
          createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : now,
          updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : now,
          version: typeof raw.version === 'number' ? raw.version : 1
        });
        this.sources.set(parsed.data.id, 'catalog');
        count++;
      }
      logger.info(`Loaded ${count} prompts from catalog ${url.href}`);
      return count;
    } catch (error) {
      logger.warn(`Catalog ${location} not loaded: ${error instanceof Error ? error.message : String(error)}`);
      return 0;
    }
  }

  /** Loads prompts from PROMPTS_DIR (or the data/prompts shipped with the package), falling back to data/sample-prompts.json. */
  loadDefault(env: NodeJS.ProcessEnv = process.env): void {
    try {
      const promptsDir = env.PROMPTS_DIR || path.join(PACKAGE_ROOT, 'data', 'prompts');
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
          this.sources.set(prompt.id, 'bundled');
        }
        logger.info(`Loaded ${sampleData.prompts.length} sample prompts`);
      }
    } catch (error) {
      logger.warn('Could not load prompts:', error);
    }
  }

  /** Recursively loads every *.json prompt under dir (index.json excluded). Returns how many loaded. */
  loadDirectory(dir: string, source: PromptSource = 'bundled'): number {
    let count = 0;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          count += this.loadDirectory(fullPath, source);
        } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
          try {
            const promptData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            this.prompts.set(promptData.id, {
              ...promptData,
              createdAt: promptData.createdAt || new Date().toISOString(),
              updatedAt: promptData.updatedAt || new Date().toISOString(),
              version: promptData.version || 1
            });
            this.sources.set(promptData.id, source);
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
    return promptList.map(prompt => {
      const language = (prompt.metadata as Record<string, unknown> | undefined)?.language;
      return {
        id: prompt.id,
        name: prompt.name,
        description: prompt.description || 'No description',
        tags: prompt.tags ?? [],
        isTemplate: prompt.isTemplate || false,
        createdAt: prompt.createdAt,
        version: prompt.version,
        ...(typeof language === 'string' ? { language } : {})
      };
    });
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
    this.sources.set(id, 'session');
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
    this.sources.delete(id);
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
      )) as string[],
      sources: this.sourceCounts()
    };
  }

  private sourceCounts(): Record<PromptSource, number> {
    const counts: Record<PromptSource, number> = { bundled: 0, catalog: 0, user: 0, session: 0 };
    for (const id of this.prompts.keys()) counts[this.sources.get(id) ?? 'session']++;
    return counts;
  }
}

/** Reads at most maxBytes of the body, so a huge or endless response cannot exhaust memory. */
async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(`catalog is ${declared} bytes, over the ${maxBytes}-byte limit`);
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`catalog is over the ${maxBytes}-byte limit`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}
