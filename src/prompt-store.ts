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

/**
 * Which library prompts an install serves. Plain prompts and templates are chosen separately:
 * `prompts` applies to prompts with isTemplate false, `templates` to the rest.
 */
export interface Selection {
  prompts: Selector;
  templates: Selector;
  /** Ids, groups or tag:<name> entries left out of both lists. */
  exclude: string[];
}

/** 'all', or entries that match a group, an id or tag:<name>. An empty list selects nothing. */
export type Selector = 'all' | string[];

export const SELECT_ALL: Selection = { prompts: 'all', templates: 'all', exclude: [] };

/**
 * Where a prompt came from. Only library prompts are subject to a Selection: prompts from the
 * user's own directories and prompts added while the server runs are always served.
 */
export type PromptOrigin =
  | { kind: 'library'; group: string }
  | { kind: 'user'; dir: string }
  | { kind: 'runtime' };

export interface CatalogGroup {
  /** Directory relative to the library root, with / separators; '' for files at the root. */
  group: string;
  prompts: { total: number; selected: number };
  templates: { total: number; selected: number };
}

export interface Catalog {
  /** The library directory, or undefined when the bundled sample file was used. */
  library?: string;
  totals: { prompts: number; templates: number; selectedPrompts: number; selectedTemplates: number };
  groups: CatalogGroup[];
  tags: Array<{ tag: string; count: number }>;
  /** Every prompt this store serves, library or not. */
  served: Array<{ id: string; name: string; template: boolean; source: PromptOrigin['kind']; group?: string }>;
}

/** True when the entry (a group, an id or tag:<name>) matches the prompt. A group also matches its subgroups. */
export function matchesEntry(entry: string, prompt: { id: string; tags?: string[] }, group: string): boolean {
  if (entry.startsWith('tag:')) return (prompt.tags ?? []).includes(entry.slice('tag:'.length));
  return entry === prompt.id || entry === group || group.startsWith(`${entry}/`);
}

export function isSelectAll(selection: Selection): boolean {
  return selection.prompts === 'all' && selection.templates === 'all' && selection.exclude.length === 0;
}

type Visibility = (prompt: StoredPrompt, origin: PromptOrigin) => boolean;

function selectionFilter(selection: Selection): Visibility {
  return (prompt, origin) => {
    if (origin.kind !== 'library') return true;
    if (selection.exclude.some(entry => matchesEntry(entry, prompt, origin.group))) return false;
    const selector = prompt.isTemplate ? selection.templates : selection.prompts;
    return selector === 'all' || selector.some(entry => matchesEntry(entry, prompt, origin.group));
  };
}

interface SharedState {
  prompts: Map<string, StoredPrompt>;
  origins: Map<string, PromptOrigin>;
  library?: string;
}

export class PromptStore {
  // Views made by select() share this state and add filters, so a prompt added through any view
  // is stored once.
  private shared: SharedState = { prompts: new Map(), origins: new Map() };
  private filters: Visibility[] = [];

  /** Number of prompts this store serves. */
  get size(): number {
    return this.all().length;
  }

  /**
   * A view of this store that serves only the library prompts the selection picks. Views can be
   * narrowed again; each step can only take prompts away.
   */
  select(selection: Selection): PromptStore {
    if (isSelectAll(selection)) return this;
    const view = new PromptStore();
    view.shared = this.shared;
    view.filters = [...this.filters, selectionFilter(selection)];
    return view;
  }

  /** Loads PROMPTS_DIR (or the data/prompts shipped with the package), falling back to data/sample-prompts.json. */
  loadDefault(): void {
    this.load({ promptsDir: process.env.PROMPTS_DIR || undefined });
  }

  /**
   * Loads the library (promptsDir, else the bundled data/prompts, else data/sample-prompts.json)
   * and then each of the user's own directories. Returns how many prompts were loaded.
   */
  load(options: { promptsDir?: string; dirs?: string[] } = {}): number {
    let count = 0;
    try {
      const promptsDir = options.promptsDir || path.join(PACKAGE_ROOT, 'data', 'prompts');
      if (fs.existsSync(promptsDir)) {
        count += this.loadDirectory(promptsDir);
        this.shared.library = promptsDir;
        logger.info(`Loaded ${count} prompts from directory structure`);
      } else {
        if (options.promptsDir) logger.warn(`Prompts directory ${options.promptsDir} does not exist`);
        count += this.loadSamples();
      }
    } catch (error) {
      logger.warn('Could not load prompts:', error);
    }
    for (const dir of options.dirs ?? []) {
      if (!fs.existsSync(dir)) {
        logger.warn(`Prompts directory ${dir} does not exist`);
        continue;
      }
      const loaded = this.loadDirectory(dir, 'user');
      logger.info(`Loaded ${loaded} prompts from ${dir}`);
      count += loaded;
    }
    return count;
  }

  private loadSamples(): number {
    const sampleDataPath = path.join(PACKAGE_ROOT, 'data', 'sample-prompts.json');
    if (!fs.existsSync(sampleDataPath)) return 0;
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    const now = new Date().toISOString();
    for (const prompt of sampleData.prompts) {
      this.shared.prompts.set(prompt.id, { ...prompt, createdAt: now, updatedAt: now, version: 1 });
      this.shared.origins.set(prompt.id, { kind: 'library', group: '' });
    }
    logger.info(`Loaded ${sampleData.prompts.length} sample prompts`);
    return sampleData.prompts.length;
  }

  /**
   * Recursively loads every *.json prompt under dir (index.json excluded). Library prompts are
   * grouped by their directory relative to dir. Returns how many loaded.
   */
  loadDirectory(dir: string, kind: 'library' | 'user' = 'library'): number {
    return this.loadTree(dir, dir, kind);
  }

  private loadTree(root: string, dir: string, kind: 'library' | 'user'): number {
    let count = 0;
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          count += this.loadTree(root, fullPath, kind);
        } else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json') {
          try {
            const promptData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            if (typeof promptData?.id !== 'string' || !promptData.id) {
              logger.warn(`Skipped ${fullPath}: it has no string id`);
              continue;
            }
            this.shared.prompts.set(promptData.id, {
              ...promptData,
              createdAt: promptData.createdAt || new Date().toISOString(),
              updatedAt: promptData.updatedAt || new Date().toISOString(),
              version: promptData.version || 1
            });
            this.shared.origins.set(
              promptData.id,
              kind === 'user'
                ? { kind: 'user', dir: root }
                : { kind: 'library', group: path.relative(root, dir).split(path.sep).join('/') }
            );
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

  private originOf(id: string): PromptOrigin {
    return this.shared.origins.get(id) ?? { kind: 'runtime' };
  }

  private isVisible(prompt: StoredPrompt): boolean {
    const origin = this.originOf(prompt.id);
    return this.filters.every(filter => filter(prompt, origin));
  }

  /** Every prompt this store serves, in load order. */
  all(): StoredPrompt[] {
    return Array.from(this.shared.prompts.values()).filter(prompt => this.isVisible(prompt));
  }

  /** Prompts carrying any of the tags and containing the search text (name or content). */
  list(filter: { tags?: string[]; search?: string } = {}): PromptSummary[] {
    let promptList = this.all();
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
    const prompt = this.shared.prompts.get(id);
    if (!prompt || !this.isVisible(prompt)) throw new PromptNotFoundError(id);
    return prompt;
  }

  add(input: CreatePromptInput): StoredPrompt {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const now = new Date().toISOString();
    const prompt: StoredPrompt = { ...input, id, createdAt: now, updatedAt: now, version: 1 };
    this.shared.prompts.set(id, prompt);
    this.shared.origins.set(id, { kind: 'runtime' });
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
    this.shared.prompts.set(id, updated);
    logger.info(`Updated prompt: ${id}`);
    return updated;
  }

  delete(id: string): StoredPrompt {
    const prompt = this.get(id);
    this.shared.prompts.delete(id);
    this.shared.origins.delete(id);
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
    const promptList = this.all();
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

  private libraryPrompts(): Array<{ prompt: StoredPrompt; group: string }> {
    const result: Array<{ prompt: StoredPrompt; group: string }> = [];
    for (const prompt of this.shared.prompts.values()) {
      const origin = this.originOf(prompt.id);
      if (origin.kind === 'library') result.push({ prompt, group: origin.group });
    }
    return result;
  }

  /** The library's groups and tags, with how much of each this store serves. */
  catalog(): Catalog {
    const groups = new Map<string, CatalogGroup>();
    const tags = new Map<string, number>();
    const totals = { prompts: 0, templates: 0, selectedPrompts: 0, selectedTemplates: 0 };
    for (const { prompt, group } of this.libraryPrompts()) {
      let row = groups.get(group);
      if (!row) {
        row = { group, prompts: { total: 0, selected: 0 }, templates: { total: 0, selected: 0 } };
        groups.set(group, row);
      }
      const selected = this.isVisible(prompt);
      const counts = prompt.isTemplate ? row.templates : row.prompts;
      counts.total++;
      if (selected) counts.selected++;
      if (prompt.isTemplate) {
        totals.templates++;
        if (selected) totals.selectedTemplates++;
      } else {
        totals.prompts++;
        if (selected) totals.selectedPrompts++;
      }
      for (const tag of prompt.tags ?? []) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }
    return {
      library: this.shared.library,
      totals,
      groups: Array.from(groups.values()).sort((a, b) => a.group.localeCompare(b.group)),
      tags: Array.from(tags, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
      served: this.all().map(prompt => {
        const origin = this.originOf(prompt.id);
        return {
          id: prompt.id,
          name: prompt.name,
          template: Boolean(prompt.isTemplate),
          source: origin.kind,
          ...(origin.kind === 'library' ? { group: origin.group } : {}),
        };
      }),
    };
  }

  /**
   * Entries of the selection that select nothing from this store's library, or that name prompts
   * of the other kind (a group of templates listed under prompts, say).
   */
  selectionWarnings(selection: Selection): string[] {
    const library = this.libraryPrompts();
    const count = (entry: string, templates: boolean) =>
      library.filter(({ prompt, group }) => Boolean(prompt.isTemplate) === templates && matchesEntry(entry, prompt, group)).length;
    const warnings: string[] = [];
    const check = (list: 'prompts' | 'templates') => {
      const selector = selection[list];
      if (selector === 'all') return;
      const wantTemplates = list === 'templates';
      for (const entry of selector) {
        if (count(entry, wantTemplates) > 0) continue;
        const other = count(entry, !wantTemplates);
        warnings.push(other > 0
          ? `${list}: "${entry}" matches only ${wantTemplates ? 'plain prompts' : 'templates'} (${other}); list it under ${wantTemplates ? 'prompts' : 'templates'} instead`
          : `${list}: "${entry}" matches no group, id or tag in the library`);
      }
    };
    check('prompts');
    check('templates');
    for (const entry of selection.exclude) {
      if (count(entry, true) + count(entry, false) === 0) {
        warnings.push(`exclude: "${entry}" matches no group, id or tag in the library`);
      }
    }
    return warnings;
  }
}
