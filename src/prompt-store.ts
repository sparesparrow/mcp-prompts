import { z } from 'zod';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils.js';

// Shared by the MCP stdio server and the HTTP server, so both serve the same prompts the same way.

// The package root (dist/..), not the cwd: MCP clients start the server from the user's project.
const PACKAGE_ROOT = path.join(__dirname, '..');

/** Ids appear in URLs and, with a state directory, in file names, so new ones stay in a safe alphabet. */
export const PROMPT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/** Upper bound on a prompt's content, so one request cannot fill memory or the state directory. */
export const MAX_CONTENT_CHARS = 1_000_000;

const VariableSchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    required: z.boolean().default(true),
    type: z.enum(['string', 'number', 'boolean']).default('string')
  })
]);

export const PromptSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'name must not be empty'),
  description: z.string().optional(),
  content: z.string().min(1, 'content must not be empty').max(MAX_CONTENT_CHARS),
  isTemplate: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  category: z.string().optional(),
  variables: z.array(VariableSchema).optional(),
  metadata: z.record(z.string(), z.any()).optional()
});

export const CreatePromptParams = PromptSchema.omit({ id: true }).extend({
  id: z.string()
    .regex(PROMPT_ID_PATTERN, 'id must start with a letter or digit and contain only letters, digits, ".", "_" or "-" (at most 128 characters)')
    .optional()
    .describe('Stable id for the new prompt. Left out, the server assigns a random one.')
});
// zod 4 applies .default() values inside .partial(), which would reset isTemplate and tags on every
// update that leaves them out; updates override those two fields without defaults.
export const UpdatePromptParams = PromptSchema.partial().omit({ id: true }).extend({
  isTemplate: z.boolean().optional(),
  tags: z.array(z.string()).optional()
});

// What a prompt file must contain to be served. Deliberately looser than PromptSchema (unknown keys
// such as lang, status and agentConfig are kept), but strict about the fields every operation reads:
// one file with a missing name or a non-array tags used to break search for the whole library.
const PromptFileSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string().min(1),
  content: z.string(),
  description: z.string().optional(),
  isTemplate: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  variables: z.array(z.union([z.string(), z.looseObject({ name: z.string() })])).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  version: z.union([z.number(), z.string()]).optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export type CreatePromptInput = z.infer<typeof CreatePromptParams>;
export type UpdatePromptInput = z.infer<typeof UpdatePromptParams>;

export interface StoredPrompt extends CreatePromptInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  /** A counter for prompts added at runtime; library files may carry a semver string instead. */
  version: number | string;
  [key: string]: unknown;
}

export interface PromptSummary {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isTemplate: boolean;
  category?: string;
  createdAt: string;
  version: number | string;
}

export interface ListFilter {
  /** Prompts carrying any of these tags. */
  tags?: string[];
  /** Text looked for in the name, description and content, ignoring case. */
  search?: string;
  category?: string;
  isTemplate?: boolean;
}

/** One page of a listing, with what a caller needs to ask for the next one. */
export interface PromptPage {
  total: number;
  count: number;
  offset: number;
  limit: number;
  has_more: boolean;
  next_offset?: number;
  prompts: PromptSummary[];
}

export interface PromptStats {
  total: number;
  templates: number;
  regular: number;
  tags: string[];
  categories: string[];
  /** 'file' when changes are saved to a state directory, 'memory' when they end with the process. */
  storage: 'memory' | 'file';
}

export interface RenderedTemplate {
  text: string;
  /** Placeholders left in the text because no value was given for them. */
  missing: string[];
  /** Values that were given but that the template does not use (often a misspelt name). */
  unused: string[];
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

/** A prompt with the requested id already exists. */
export class PromptConflictError extends Error {
  constructor(id: string) {
    super(`A prompt with ID ${id} already exists`);
  }
}

/** A change could not be saved to the state directory; the prompt was left as it was. */
export class PromptStorageError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * The version after an update. Counters go up by one and x.y.z gets its patch number raised; any
 * other label is the author's and stays as written. (Adding 1 to the string "1.0.0" gave "1.0.01".)
 */
export function nextVersion(version: number | string): number | string {
  if (typeof version === 'number') return version + 1;
  const semver = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (semver) return `${semver[1]}.${semver[2]}.${Number(semver[3]) + 1}`;
  if (/^\d+$/.test(version)) return String(Number(version) + 1);
  return version;
}

function categoryOf(prompt: StoredPrompt): string | undefined {
  if (typeof prompt.category === 'string' && prompt.category) return prompt.category;
  const fromMetadata = (prompt.metadata as Record<string, unknown> | undefined)?.category;
  return typeof fromMetadata === 'string' && fromMetadata ? fromMetadata : undefined;
}

function summarize(prompt: StoredPrompt): PromptSummary {
  const category = categoryOf(prompt);
  return {
    id: prompt.id,
    name: prompt.name,
    description: prompt.description || 'No description',
    tags: prompt.tags ?? [],
    isTemplate: prompt.isTemplate || false,
    ...(category ? { category } : {}),
    createdAt: prompt.createdAt,
    version: prompt.version
  };
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// {{name}} with optional spaces inside the braces. A trailing ^ (as in bash's ${name^}) upper-cases
// the first letter of the value, which the bundled Gradle templates use for task names.
const PLACEHOLDER = /\{\{\s*([^{}]+?)\s*\}\}/g;

/**
 * Fills {{name}} placeholders in one pass over the text, so a value that itself contains {{other}}
 * is inserted as written instead of being filled in by a later variable.
 */
export function renderTemplate(content: string, variables: Record<string, unknown>): RenderedTemplate {
  const has = (name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) && variables[name] !== undefined && variables[name] !== null;
  const missing = new Set<string>();
  const used = new Set<string>();
  const text = content.replace(PLACEHOLDER, (placeholder: string, rawName: string) => {
    if (has(rawName)) {
      used.add(rawName);
      return stringifyValue(variables[rawName]);
    }
    if (rawName.endsWith('^') && has(rawName.slice(0, -1))) {
      const name = rawName.slice(0, -1);
      used.add(name);
      const value = stringifyValue(variables[name]);
      return value.charAt(0).toUpperCase() + value.slice(1);
    }
    missing.add(rawName);
    return placeholder;
  });
  return {
    text,
    missing: Array.from(missing),
    unused: Object.keys(variables).filter(name => !used.has(name))
  };
}

function writeFileAtomic(file: string, data: string): void {
  // Write beside the target and rename over it, so a crash or a full disk never leaves half a file.
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`);
  const fd = fs.openSync(tmp, 'wx', 0o600);
  try {
    fs.writeSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}

const TOMBSTONES_FILE = '.deleted.json';

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
  /** Where add, update and delete are saved; undefined keeps them in memory only. */
  stateDir?: string;
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

  /** The directory changes are saved to, or undefined when they are kept in memory only. */
  get stateDir(): string | undefined {
    return this.shared.stateDir;
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
      logger.warn({ err: error }, 'Could not load prompts');
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
    let count = 0;
    for (const raw of Array.isArray(sampleData?.prompts) ? sampleData.prompts : []) {
      const prompt = this.checkPromptData(raw, `${sampleDataPath} (${String(raw?.id)})`);
      if (!prompt) continue;
      this.shared.prompts.set(prompt.id, prompt);
      this.shared.origins.set(prompt.id, { kind: 'library', group: '' });
      count++;
    }
    logger.info(`Loaded ${count} sample prompts`);
    return count;
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
          const prompt = this.readPromptFile(fullPath);
          if (!prompt) continue;
          this.shared.prompts.set(prompt.id, prompt);
          this.shared.origins.set(
            prompt.id,
            kind === 'user'
              ? { kind: 'user', dir: root }
              : { kind: 'library', group: path.relative(root, dir).split(path.sep).join('/') }
          );
          count++;
        }
      }
    } catch (err) {
      logger.warn({ err }, `Failed to read directory ${dir}`);
    }
    return count;
  }

  /** Reads one prompt file; logs why and returns undefined when it cannot be served. */
  private readPromptFile(file: string): StoredPrompt | undefined {
    let raw: unknown;
    try {
      raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      logger.warn({ err }, `Skipped ${file}: it is not readable JSON`);
      return undefined;
    }
    return this.checkPromptData(raw, file);
  }

  private checkPromptData(raw: unknown, source: string): StoredPrompt | undefined {
    const checked = PromptFileSchema.safeParse(raw);
    if (!checked.success) {
      const [issue] = checked.error.issues;
      const where = issue.path.length > 0 ? issue.path.join('.') : 'file';
      logger.warn(`Skipped ${source}: ${where}: ${issue.message}`);
      return undefined;
    }
    // Keep the file's own keys as they are; only fill in what every operation relies on.
    const data = raw as Record<string, unknown> & z.infer<typeof PromptFileSchema>;
    const now = new Date().toISOString();
    return {
      ...data,
      isTemplate: data.isTemplate ?? false,
      tags: data.tags ?? [],
      createdAt: data.createdAt || now,
      updatedAt: data.updatedAt || now,
      version: data.version ?? 1
    } as StoredPrompt;
  }

  /**
   * Saves add, update and delete under dir from now on, after loading what earlier runs saved
   * there: saved prompts replace library ones with the same id, and deleted ids stay deleted.
   * With readOnly the directory is only read. Returns how many saved prompts were loaded.
   */
  openStateDir(dir: string, options: { readOnly?: boolean } = {}): number {
    const readOnly = options.readOnly ?? false;
    if (!readOnly) {
      try {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
        // Left behind by a write that was interrupted before its rename.
        for (const name of fs.readdirSync(dir)) {
          if (name.startsWith('.') && name.endsWith('.tmp')) fs.rmSync(path.join(dir, name), { force: true });
        }
      } catch (error) {
        throw new PromptStorageError(
          `State directory ${dir} is not writable (${error instanceof Error ? error.message : String(error)}). ` +
          'Mount or create a writable directory, or start read-only.'
        );
      }
    } else if (!fs.existsSync(dir)) {
      logger.warn(`State directory ${dir} does not exist; nothing saved was loaded`);
      return 0;
    }

    for (const id of this.readTombstones(dir)) {
      this.shared.prompts.delete(id);
      this.shared.origins.delete(id);
    }
    let count = 0;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name.startsWith('.')) continue;
      const prompt = this.readPromptFile(path.join(dir, entry.name));
      if (!prompt) continue;
      this.shared.prompts.set(prompt.id, prompt);
      // A saved edit of a library prompt stays a library prompt, so selections still apply to it.
      if (!this.shared.origins.has(prompt.id)) this.shared.origins.set(prompt.id, { kind: 'runtime' });
      count++;
    }
    if (!readOnly) this.shared.stateDir = dir;
    logger.info(`Loaded ${count} saved prompts from ${dir}`);
    return count;
  }

  private stateFile(id: string): string {
    // Lower-case safe ids are their own file name; anything else is hashed, so two ids can never
    // share a file (not even on a case-insensitive file system) and no id can leave the directory.
    const name = /^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)
      ? id
      : `x-${crypto.createHash('sha256').update(id).digest('hex').slice(0, 40)}`;
    return path.join(this.shared.stateDir!, `${name}.json`);
  }

  private readTombstones(dir: string): string[] {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(dir, TOMBSTONES_FILE), 'utf8'));
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  private writeTombstones(change: (ids: Set<string>) => void): void {
    const dir = this.shared.stateDir!;
    // Re-read first: another server process may share this directory.
    const ids = new Set(this.readTombstones(dir));
    const before = ids.size;
    change(ids);
    if (ids.size === before) return;
    writeFileAtomic(path.join(dir, TOMBSTONES_FILE), `${JSON.stringify(Array.from(ids).sort(), null, 2)}\n`);
  }

  /** Runs a state-directory write, turning a file system failure into a PromptStorageError. */
  private saving(what: string, write: () => void): void {
    if (!this.shared.stateDir) return;
    try {
      write();
    } catch (error) {
      logger.error({ err: error }, `Could not save ${what} to ${this.shared.stateDir}`);
      // The log has the path and the full error; callers get the error code only.
      const code = (error as NodeJS.ErrnoException)?.code ?? 'write failed';
      throw new PromptStorageError(`Could not save ${what} to the state directory (${code}); nothing was changed`);
    }
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

  private matching(filter: ListFilter): StoredPrompt[] {
    let promptList = this.all();
    if (filter.tags && filter.tags.length > 0) {
      promptList = promptList.filter(prompt => filter.tags!.some(tag => (prompt.tags ?? []).includes(tag)));
    }
    if (filter.category) {
      promptList = promptList.filter(prompt => categoryOf(prompt) === filter.category);
    }
    if (filter.isTemplate !== undefined) {
      promptList = promptList.filter(prompt => Boolean(prompt.isTemplate) === filter.isTemplate);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      promptList = promptList.filter(prompt =>
        prompt.name.toLowerCase().includes(searchLower) ||
        (prompt.description ?? '').toLowerCase().includes(searchLower) ||
        prompt.content.toLowerCase().includes(searchLower)
      );
    }
    return promptList;
  }

  /** Prompts matching the filter: any of the tags, and the search text in name, description or content. */
  list(filter: ListFilter = {}): PromptSummary[] {
    return this.matching(filter).map(summarize);
  }

  /** One page of list(filter), in load order, with the total and where the next page starts. */
  page(filter: ListFilter = {}, paging: { limit?: number; offset?: number } = {}): PromptPage {
    const matches = this.matching(filter);
    const offset = Math.max(0, paging.offset ?? 0);
    const limit = Math.max(1, paging.limit ?? Math.max(1, matches.length));
    const prompts = matches.slice(offset, offset + limit).map(summarize);
    const hasMore = offset + prompts.length < matches.length;
    return {
      total: matches.length,
      count: prompts.length,
      offset,
      limit,
      has_more: hasMore,
      ...(hasMore ? { next_offset: offset + prompts.length } : {}),
      prompts
    };
  }

  get(id: string): StoredPrompt {
    const prompt = this.shared.prompts.get(id);
    if (!prompt || !this.isVisible(prompt)) throw new PromptNotFoundError(id);
    return prompt;
  }

  add(input: CreatePromptInput): StoredPrompt {
    const { id: requestedId, ...fields } = input;
    // An id taken by a prompt outside this view's selection is taken all the same.
    if (requestedId !== undefined && this.shared.prompts.has(requestedId)) throw new PromptConflictError(requestedId);
    const id = requestedId ?? `prompt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const now = new Date().toISOString();
    const prompt: StoredPrompt = { ...fields, id, createdAt: now, updatedAt: now, version: 1 };
    this.saving(`prompt ${id}`, () => {
      writeFileAtomic(this.stateFile(id), `${JSON.stringify(prompt, null, 2)}\n`);
      this.writeTombstones(ids => ids.delete(id));
    });
    this.shared.prompts.set(id, prompt);
    this.shared.origins.set(id, { kind: 'runtime' });
    logger.info(`Added prompt: ${id}`);
    return prompt;
  }

  update(id: string, updates: UpdatePromptInput): StoredPrompt {
    const prompt = this.get(id);
    const changes = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));
    if (Object.keys(changes).length === 0) {
      throw new PromptUsageError('Nothing to update: give at least one field to change (name, description, content, isTemplate, tags, category, variables or metadata)');
    }
    const updated: StoredPrompt = {
      ...prompt,
      ...changes,
      id,
      updatedAt: new Date().toISOString(),
      version: nextVersion(prompt.version)
    };
    this.saving(`prompt ${id}`, () => writeFileAtomic(this.stateFile(id), `${JSON.stringify(updated, null, 2)}\n`));
    this.shared.prompts.set(id, updated);
    logger.info(`Updated prompt: ${id}`);
    return updated;
  }

  delete(id: string): StoredPrompt {
    const prompt = this.get(id);
    const origin = this.originOf(id);
    this.saving(`the deletion of prompt ${id}`, () => {
      // A prompt that also exists in the library or a user directory would come back at the next
      // start, so its id is recorded as deleted.
      if (origin.kind !== 'runtime') this.writeTombstones(ids => ids.add(id));
      fs.rmSync(this.stateFile(id), { force: true });
    });
    this.shared.prompts.delete(id);
    this.shared.origins.delete(id);
    logger.info(`Deleted prompt: ${id}`);
    return prompt;
  }

  /** Fills a template prompt's placeholders and reports which were left unfilled. */
  render(id: string, variables: Record<string, unknown>): RenderedTemplate {
    const prompt = this.get(id);
    if (!prompt.isTemplate) {
      throw new PromptUsageError(`Prompt "${prompt.name}" is not a template`);
    }
    return renderTemplate(prompt.content, variables);
  }

  /** Fills {{name}} placeholders of a template prompt; a variable left out stays as a literal {{name}}. */
  applyTemplate(id: string, variables: Record<string, unknown>): string {
    return this.render(id, variables).text;
  }

  stats(): PromptStats {
    const promptList = this.all();
    return {
      total: promptList.length,
      templates: promptList.filter(p => p.isTemplate).length,
      regular: promptList.filter(p => !p.isTemplate).length,
      tags: Array.from(new Set(promptList.flatMap(p => p.tags || []))).sort(),
      categories: Array.from(new Set(promptList.map(categoryOf).filter((c): c is string => Boolean(c)))).sort(),
      storage: this.shared.stateDir ? 'file' : 'memory'
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
