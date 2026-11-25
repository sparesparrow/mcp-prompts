import { z } from 'zod';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { logger } from './utils.js';
import { FileStateBackend, PromptConflictError, PromptStaleError, PromptStorageError, type StateBackend, type StateSnapshot } from './state-backend.js';

export { PromptConflictError, PromptStaleError, PromptStorageError } from './state-backend.js';
export type { StateBackend, StateSnapshot } from './state-backend.js';

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
  /** metadata.language, when present, so callers can choose a language without fetching each prompt. */
  language?: string;
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

/** One category of the served prompts: how many prompts it holds, and how many of those are templates. */
export interface CategorySummary {
  category: string;
  count: number;
  templates: number;
}

export interface PromptStats {
  total: number;
  templates: number;
  regular: number;
  tags: string[];
  categories: string[];
  /** Where changes are saved: 'file' (a state directory), 'postgres', or 'memory' when they end with the process. */
  storage: 'memory' | 'file' | 'postgres';
  sources: { bundled: number; catalog: number; user: number; session: number };
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

/** A profile was asked for that the library does not define. */
export class UnknownProfileError extends Error {
  constructor(public readonly unknown: string[], public readonly available: string[]) {
    super(
      `unknown profile ${unknown.map(name => `"${name}"`).join(', ')}: ` +
      (available.length > 0 ? `this library has ${available.join(', ')}` : 'this library defines no profiles (it has no profiles.json)')
    );
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

/** The longest description a list shows; get_prompt returns the whole one. */
export const MAX_SUMMARY_DESCRIPTION = 110;

/** The text cut to at most `max` characters, ending in an ellipsis when something was left out. */
export function shorten(value: string, max: number): string {
  if (value.length <= max) return value;
  let end = max - 1;
  // Do not leave half of a character that takes two code units.
  const last = value.charCodeAt(end - 1);
  if (last >= 0xd800 && last <= 0xdbff) end--;
  return `${value.slice(0, end)}…`;
}

function summarize(prompt: StoredPrompt): PromptSummary {
  const category = categoryOf(prompt);
  const language = (prompt.metadata as Record<string, unknown> | undefined)?.language;
  return {
    id: prompt.id,
    name: prompt.name,
    description: shorten(prompt.description || 'No description', MAX_SUMMARY_DESCRIPTION),
    tags: prompt.tags ?? [],
    isTemplate: prompt.isTemplate || false,
    ...(category ? { category } : {}),
    createdAt: prompt.createdAt,
    version: prompt.version,
    ...(typeof language === 'string' ? { language } : {})
  };
}

function stringifyValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// {{name}} with optional spaces inside the braces. A trailing ^ (as in bash's ${name^}) upper-cases
// the first letter of the value, which the bundled Gradle templates use for task names.
// The spaces are trimmed in code: with \s* on both sides of a lazy group the pattern took time
// cubic in the length of an unclosed "{{   ...", and a prompt may be a megabyte long.
const PLACEHOLDER = /\{\{([^{}]+)\}\}/g;

/**
 * Fills {{name}} placeholders in one pass over the text, so a value that itself contains {{other}}
 * is inserted as written instead of being filled in by a later variable.
 */
export function renderTemplate(content: string, variables: Record<string, unknown>): RenderedTemplate {
  const has = (name: string) =>
    Object.prototype.hasOwnProperty.call(variables, name) && variables[name] !== undefined && variables[name] !== null;
  const missing = new Set<string>();
  const used = new Set<string>();
  const text = content.replace(PLACEHOLDER, (placeholder: string, inner: string) => {
    const rawName = inner.trim();
    // Braces around nothing but spaces are text, not a placeholder.
    if (rawName === '') return placeholder;
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

/** JSON files in a library that are not prompts: a generated index, and the profiles. */
const NOT_PROMPTS = ['index.json', 'profiles.json'];
const CATALOG_TIMEOUT_MS = 5_000;
const CATALOG_MAX_BYTES = 1024 * 1024;
const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function isLocalHttp(url: URL): boolean {
  return url.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(url.hostname);
}

function catalogOrigin(location: string): string {
  try {
    return new URL(location).origin;
  } catch {
    return '[invalid catalog URL]';
  }
}

async function fetchCatalog(url: URL, allowLocalHttp: boolean, timeoutMs: number): Promise<Response> {
  let current = url;
  const signal = AbortSignal.timeout(timeoutMs);
  const redirectStatuses = new Set([301, 302, 303, 307, 308]);
  for (let redirects = 0; redirects <= 5; redirects++) {
    const response = await fetch(current, { signal, redirect: 'manual' });
    if (!redirectStatuses.has(response.status)) return response;
    const location = response.headers.get('location');
    if (!location || redirects === 5) {
      await response.body?.cancel();
      throw new Error('catalog redirect is missing a location or exceeded the redirect limit');
    }
    const next = new URL(location, current);
    const allowed = allowLocalHttp ? isLocalHttp(next) : next.protocol === 'https:';
    await response.body?.cancel();
    if (!allowed) throw new Error(`catalog redirect to ${next.origin} was refused`);
    current = next;
  }
  throw new Error('catalog exceeded the redirect limit');
}

function byName(a: fs.Dirent, b: fs.Dirent): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
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
 * A named selection kept with the library, in <library>/profiles.json: the prompts one kind of
 * work needs. An install that names a profile serves only those, so listings are short and an
 * agent is not offered car prompts while it reviews a web backend.
 */
export interface Profile {
  name: string;
  description: string;
  selection: Selection;
}

/** A profile with how much of the library it serves. */
export interface ProfileSummary {
  name: string;
  description: string;
  prompts: number;
  templates: number;
  /** Entries of the profile that match nothing in the library (see selectionWarnings). */
  warnings: string[];
}

export const PROFILES_FILE = 'profiles.json';

const ProfileSelector = z.union([z.literal('all'), z.literal('none'), z.array(z.string().min(1))]);
const ProfilesFileSchema = z.looseObject({
  profiles: z.record(
    z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'a profile name is lower-case letters, digits and "-"'),
    z.strictObject({
      description: z.string().default(''),
      prompts: ProfileSelector.default('all'),
      templates: ProfileSelector.default('all'),
      exclude: z.array(z.string().min(1)).default([]),
    })
  ),
});

/**
 * Where a prompt came from. Only library prompts are subject to a Selection: prompts from the
 * user's own directories and prompts added while the server runs are always served.
 */
export type PromptOrigin =
  | { kind: 'library'; group: string }
  | { kind: 'user'; dir: string }
  | { kind: 'catalog'; url: string }
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
  /** The library's profiles.json, by name. */
  profiles: Map<string, Profile>;
  /** Where add, update and delete are saved; undefined keeps them in memory only. */
  backend?: StateBackend;
  /**
   * Set once a backend is attached: what the library and the user's directories hold, before
   * anything saved is applied. The served prompts are rebuilt from it whenever the backend
   * changes, which is how several servers sharing one backend see each other's changes.
   */
  pristine?: { prompts: Map<string, StoredPrompt>; origins: Map<string, PromptOrigin> };
  /** What the backend held when it was last read, and its revision from just before that read. */
  saved?: { snapshot: StateSnapshot; revision: string };
  /** The change last queued for each prompt id, so changes to one prompt are applied one by one. */
  queued: Map<string, Promise<unknown>>;
  /** The backend answers with promises, so it is checked in the background (see refresh). */
  asyncBackend?: boolean;
  /** How long to leave between checks of an asynchronous backend. */
  refreshMs: number;
  /** When an asynchronous backend was last asked, from Date.now(). */
  lastCheck: number;
  /** The check of the backend that is running, so concurrent callers share one. */
  checking?: Promise<void>;
  /** Changes made through this store so far; a read of the backend that overlapped one is repeated. */
  writes: number;
  /** The last check failed and was reported; the next failure is not reported again until one succeeds. */
  checkFailed: boolean;
  /** How long one question to an asynchronous backend may take before it counts as failed. */
  checkTimeoutMs: number;
}

/** A backend that has not answered in this long is treated as down; its own limits normally come first. */
export const CHECK_TIMEOUT_MS = 15_000;

/** Settles with the work, or rejects with a PromptStorageError (which says nothing about the cause) after ms. */
function withTimeout<T>(work: Promise<T> | T, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new PromptStorageError('The database did not answer in time')), ms);
    Promise.resolve(work).then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

/** How long to leave between checks of a backend that can only be asked asynchronously. */
export const REFRESH_INTERVAL_MS = 2_000;

function newSharedState(): SharedState {
  return {
    prompts: new Map(), origins: new Map(), profiles: new Map(), queued: new Map(),
    refreshMs: REFRESH_INTERVAL_MS, lastCheck: 0, writes: 0, checkFailed: false, checkTimeoutMs: CHECK_TIMEOUT_MS,
  };
}

export class PromptStore {
  // Views made by select() share this state and add filters, so a prompt added through any view
  // is stored once.
  private shared: SharedState = newSharedState();
  private filters: Visibility[] = [];

  /** Number of prompts this store serves. */
  get size(): number {
    return this.all().length;
  }

  /** Where changes are saved: the backend's kind while it can be written, otherwise memory. */
  get storage(): 'memory' | 'file' | 'postgres' {
    const { backend } = this.shared;
    return backend?.writable ? backend.kind : 'memory';
  }

  /** The directory changes are saved to, or undefined when they are kept in memory only. */
  get stateDir(): string | undefined {
    const { backend } = this.shared;
    return backend instanceof FileStateBackend && backend.writable ? backend.dir : undefined;
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

  /** The profiles the library defines, in the order of its profiles.json. */
  get profileNames(): string[] {
    return Array.from(this.shared.profiles.keys());
  }

  /**
   * A view that serves the library prompts of the named profiles: of any of them, when several
   * are named. Like select(), it only takes prompts away, and it leaves the user's own
   * directories and prompts added at runtime alone. Throws UnknownProfileError for a name the
   * library does not define.
   */
  selectProfiles(names: string[]): PromptStore {
    if (names.length === 0) return this;
    const unknown = names.filter(name => !this.shared.profiles.has(name));
    if (unknown.length > 0) throw new UnknownProfileError(unknown, this.profileNames);
    const filters = names.map(name => selectionFilter(this.shared.profiles.get(name)!.selection));
    const view = new PromptStore();
    view.shared = this.shared;
    view.filters = [...this.filters, (prompt, origin) => filters.some(filter => filter(prompt, origin))];
    return view;
  }

  /** Every profile of the library, with how many plain prompts and templates it serves. */
  profiles(): ProfileSummary[] {
    this.refresh();
    const library = this.libraryPrompts();
    return Array.from(this.shared.profiles.values(), profile => {
      const serves = selectionFilter(profile.selection);
      const served = library.filter(({ prompt, group }) => serves(prompt, { kind: 'library', group }));
      return {
        name: profile.name,
        description: profile.description,
        prompts: served.filter(({ prompt }) => !prompt.isTemplate).length,
        templates: served.filter(({ prompt }) => prompt.isTemplate).length,
        warnings: this.selectionWarnings(profile.selection),
      };
    });
  }

  /** Ids of library prompts that no profile serves; they are reachable only without a profile. */
  unprofiled(): string[] {
    this.refresh();
    const filters = Array.from(this.shared.profiles.values(), profile => selectionFilter(profile.selection));
    return this.libraryPrompts()
      .filter(({ prompt, group }) => !filters.some(serves => serves(prompt, { kind: 'library', group })))
      .map(({ prompt }) => prompt.id);
  }

  private loadProfiles(dir: string): void {
    const file = path.join(dir, PROFILES_FILE);
    if (!fs.existsSync(file)) return;
    let parsed;
    try {
      parsed = ProfilesFileSchema.safeParse(JSON.parse(fs.readFileSync(file, 'utf8')));
    } catch (err) {
      logger.warn({ err }, `Ignored ${file}: it is not readable JSON`);
      return;
    }
    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      logger.warn(`Ignored ${file}: ${issue.path.join('.') || 'file'}: ${issue.message}`);
      return;
    }
    const list = (selector: 'all' | 'none' | string[]): Selector => (selector === 'none' ? [] : selector);
    for (const [name, profile] of Object.entries(parsed.data.profiles)) {
      this.shared.profiles.set(name, {
        name,
        description: profile.description,
        selection: { prompts: list(profile.prompts), templates: list(profile.templates), exclude: profile.exclude },
      });
    }
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
        this.loadProfiles(promptsDir);
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

  /**
   * Loads a remote prompt catalog after the bundled library and before user directories. Only
   * HTTPS is accepted, except for HTTP catalogs on loopback. A failed catalog leaves the store
   * unchanged; invalid entries are skipped individually.
   */
  async loadCatalog(location: string, options: { timeoutMs?: number; maxBytes?: number } = {}): Promise<number> {
    const timeoutMs = options.timeoutMs ?? CATALOG_TIMEOUT_MS;
    const maxBytes = options.maxBytes ?? CATALOG_MAX_BYTES;
    try {
      const url = new URL(location);
      const localHttp = isLocalHttp(url);
      if ((url.protocol !== 'https:' && !localHttp) || url.username !== '' || url.password !== '') {
        logger.warn(`PROMPTS_CATALOG_URL must be https (or http to localhost): ${url.origin} refused`);
        return 0;
      }

      const response = await fetchCatalog(url, localHttp, timeoutMs);
      if (!response.ok) {
        logger.warn(`Catalog ${url.origin} answered ${response.status}: skipped`);
        return 0;
      }

      const body = await readLimited(response, maxBytes);
      const data: unknown = JSON.parse(body);
      const entries = Array.isArray(data)
        ? data
        : data && typeof data === 'object' && Array.isArray((data as { prompts?: unknown }).prompts)
          ? (data as { prompts: unknown[] }).prompts
          : undefined;
      if (!entries) {
        logger.warn(`Catalog ${url.origin} is neither an array nor { "prompts": [...] }: skipped`);
        return 0;
      }

      let count = 0;
      for (const entry of entries) {
        const valid = PromptSchema.safeParse(entry);
        if (!valid.success) {
          logger.warn(`Catalog entry skipped: ${valid.error.issues[0]?.message ?? 'invalid'}`);
          continue;
        }
        const prompt = this.checkPromptData(entry, `catalog ${url.origin}`);
        if (!prompt) continue;
        this.put(prompt, { kind: 'catalog', url: url.origin });
        count++;
      }
      logger.info(`Loaded ${count} prompts from catalog ${url.origin}`);
      return count;
    } catch (error) {
      const reason = error instanceof Error ? error.name : 'error';
      logger.warn(`Catalog ${catalogOrigin(location)} not loaded (${reason})`);
      return 0;
    }
  }

  /** Records a prompt read from the library, the samples or one of the user's directories. */
  private put(prompt: StoredPrompt, origin: PromptOrigin): void {
    this.shared.prompts.set(prompt.id, prompt);
    this.shared.origins.set(prompt.id, origin);
    // Loaded after the state directory was opened: part of what a rebuild starts from.
    this.shared.pristine?.prompts.set(prompt.id, prompt);
    this.shared.pristine?.origins.set(prompt.id, origin);
  }

  private loadSamples(): number {
    const sampleDataPath = path.join(PACKAGE_ROOT, 'data', 'sample-prompts.json');
    if (!fs.existsSync(sampleDataPath)) return 0;
    const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));
    let count = 0;
    for (const raw of Array.isArray(sampleData?.prompts) ? sampleData.prompts : []) {
      const prompt = this.checkPromptData(raw, `${sampleDataPath} (${String(raw?.id)})`);
      if (!prompt) continue;
      this.put(prompt, { kind: 'library', group: '' });
      count++;
    }
    logger.info(`Loaded ${count} sample prompts`);
    return count;
  }

  /**
   * Recursively loads every *.json prompt under dir (index.json, profiles.json and hidden entries excluded),
   * following symbolic links. Library prompts are grouped by their directory relative to dir.
   * Returns how many prompts loaded; two files with one id count once, and the later file wins.
   */
  loadDirectory(dir: string, kind: 'library' | 'user' = 'library'): number {
    const visited = new Set<string>();
    try {
      visited.add(fs.realpathSync(dir));
    } catch {
      // loadTree reports a directory it cannot read.
    }
    const count = this.loadTree(dir, dir, kind, new Map(), visited);
    // Saved edits and deletions apply to what was just loaded as well.
    if (this.shared.saved) this.applySaved();
    return count;
  }

  /** Loads user directories after the library and any remote catalog, so the user's ids win. */
  loadUserDirectories(dirs: string[]): number {
    let count = 0;
    for (const dir of dirs) {
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

  private loadTree(root: string, dir: string, kind: 'library' | 'user', files: Map<string, string>, visited: Set<string>): number {
    let entries: fs.Dirent[];
    try {
      // By name, so every machine loads the prompts, and therefore lists them, in the same order.
      entries = fs.readdirSync(dir, { withFileTypes: true }).sort(byName);
    } catch (err) {
      logger.warn({ err }, `Failed to read directory ${dir}`);
      return 0;
    }
    let count = 0;
    for (const entry of entries) {
      // Hidden entries are never prompts: .git, editors' swap files, and the ..data and
      // ..<timestamp> directories behind a Kubernetes ConfigMap mount (whose visible files are
      // links into them).
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(dir, entry.name);
      let isDirectory = entry.isDirectory();
      let isFile = entry.isFile();
      if (entry.isSymbolicLink()) {
        try {
          const target = fs.statSync(fullPath);
          isDirectory = target.isDirectory();
          isFile = target.isFile();
        } catch {
          logger.warn(`Skipped ${fullPath}: the link points to nothing`);
          continue;
        }
      }
      if (isDirectory) {
        // A link back up the tree would otherwise be followed forever.
        let real: string;
        try {
          real = fs.realpathSync(fullPath);
        } catch {
          continue;
        }
        if (visited.has(real)) continue;
        visited.add(real);
        count += this.loadTree(root, fullPath, kind, files, visited);
      } else if (isFile && entry.name.endsWith('.json') && !NOT_PROMPTS.includes(entry.name)) {
        const prompt = this.readPromptFile(fullPath);
        if (!prompt) continue;
        const earlier = files.get(prompt.id);
        if (earlier) {
          logger.warn(`Duplicate prompt id "${prompt.id}": ${fullPath} replaces ${earlier}`);
        } else {
          count++;
        }
        files.set(prompt.id, fullPath);
        this.put(
          prompt,
          kind === 'user'
            ? { kind: 'user', dir: root }
            : { kind: 'library', group: path.relative(root, dir).split(path.sep).join('/') }
        );
      }
    }
    return count;
  }

  /** Reads one library file; logs why and returns undefined when it cannot be served. */
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

  private checkPromptData(raw: unknown, source: string, quiet = false): StoredPrompt | undefined {
    const checked = PromptFileSchema.safeParse(raw);
    if (!checked.success) {
      const [issue] = checked.error.issues;
      const where = issue.path.length > 0 ? issue.path.join('.') : 'file';
      if (!quiet) logger.warn(`Skipped ${source}: ${where}: ${issue.message}`);
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
   * The directory is read again whenever it changes, so servers sharing it see each other's
   * changes. With readOnly it is only read, and this store refuses changes.
   * Returns how many saved prompts were loaded.
   */
  openStateDir(dir: string, options: { readOnly?: boolean } = {}): number {
    const readOnly = options.readOnly ?? false;
    if (readOnly && !fs.existsSync(dir)) {
      logger.warn(`State directory ${dir} does not exist; nothing saved was loaded`);
      return 0;
    }
    const backend = new FileStateBackend(dir, {
      readOnly,
      parse: (raw, source, quiet) => this.checkPromptData(raw, source, quiet)
    });
    const revision = backend.revision();
    let snapshot: StateSnapshot = { prompts: [], tombstones: [] };
    try {
      snapshot = backend.load();
    } catch (err) {
      logger.warn({ err }, `Could not read state directory ${dir}; serving what was read before`);
    }
    const count = this.attach(backend, snapshot, revision);
    logger.info(`Loaded ${count} saved prompts from ${dir}`);
    return count;
  }

  /**
   * Saves add, update and delete to the backend from now on, after loading what it holds. Like
   * openStateDir, but for a backend that may answer asynchronously: such a backend is asked about
   * changes in the background, at most once per refreshIntervalMs (two seconds by default), and
   * by sync(). Returns how many saved prompts were loaded. Throws PromptStorageError when the
   * backend cannot be read, and PromptUsageError when this store already has a backend.
   */
  async useBackend(backend: StateBackend, options: { refreshIntervalMs?: number; checkTimeoutMs?: number } = {}): Promise<number> {
    this.assertNoBackend();
    let asyncBackend: boolean;
    let revision: string;
    let snapshot: StateSnapshot;
    try {
      const first = backend.revision();
      asyncBackend = typeof first !== 'string';
      revision = await first;
      snapshot = await backend.load();
    } catch (error) {
      if (error instanceof PromptStorageError) throw error;
      logger.error({ err: error }, 'Could not read the saved prompts');
      throw new PromptStorageError('Could not read the saved prompts; the backend was not used');
    }
    // Another call may have attached a backend while this one was reading.
    this.assertNoBackend();
    this.shared.asyncBackend = asyncBackend;
    this.shared.refreshMs = options.refreshIntervalMs ?? REFRESH_INTERVAL_MS;
    this.shared.checkTimeoutMs = options.checkTimeoutMs ?? CHECK_TIMEOUT_MS;
    this.shared.lastCheck = Date.now();
    return this.attach(backend, snapshot, revision);
  }

  private assertNoBackend(): void {
    if (this.shared.backend) throw new PromptUsageError('This store already saves to a backend; it can have only one');
  }

  /**
   * A store over the same library whose saved prompts come from its own backend: one owner's view
   * of a shared library. The library (and the catalog and user directories loaded into this
   * store) must be loaded before; the prompts it holds are shared, not copied, while what the
   * backend saved is private to the new store. This store must not have a backend itself.
   */
  async overlay(backend: StateBackend, options: { refreshIntervalMs?: number; checkTimeoutMs?: number } = {}): Promise<PromptStore> {
    this.assertNoBackend();
    const pristine = (this.shared.pristine ??= { prompts: new Map(this.shared.prompts), origins: new Map(this.shared.origins) });
    const store = new PromptStore();
    store.shared = {
      ...newSharedState(),
      prompts: new Map(pristine.prompts),
      origins: new Map(pristine.origins),
      library: this.shared.library,
      profiles: this.shared.profiles,
      pristine,
    };
    await store.useBackend(backend, options);
    return store;
  }

  /**
   * Asks the backend now, whatever the interval, and reads it again if something changed. Meant
   * for a request that must see what another server saved. A backend that fails is not an error
   * here: the store keeps serving what it has (and says so once in the log).
   */
  async sync(): Promise<void> {
    const { backend, saved } = this.shared;
    if (!backend || !saved) return;
    if (!this.shared.asyncBackend) {
      this.refresh();
      return;
    }
    // A check that started before this call may have missed what this call must see.
    if (this.shared.checking) await this.shared.checking;
    await this.runCheck();
  }

  /** Throws when the backend cannot be reached in time. A store without a backend is always fine. */
  async checkStorage(): Promise<void> {
    const { backend, checkTimeoutMs } = this.shared;
    if (backend) await withTimeout(backend.revision(), checkTimeoutMs);
  }

  /** The kind of backend behind this store, whether or not it can be written; undefined for memory only. */
  get backendKind(): 'file' | 'postgres' | undefined {
    return this.shared.backend?.kind;
  }

  private attach(backend: StateBackend, snapshot: StateSnapshot, revision: string): number {
    this.shared.pristine ??= { prompts: new Map(this.shared.prompts), origins: new Map(this.shared.origins) };
    this.shared.backend = backend;
    this.shared.saved = { snapshot, revision };
    return this.applySaved();
  }

  /**
   * Rebuilds what is served: the library and the user's directories, without the ids recorded as
   * deleted, with every saved prompt put over or beside them. Returns the number of saved prompts.
   */
  private applySaved(): number {
    const { saved, pristine } = this.shared;
    if (!saved || !pristine) return 0;
    const prompts = new Map(pristine.prompts);
    const origins = new Map(pristine.origins);
    for (const id of saved.snapshot.tombstones) {
      prompts.delete(id);
      origins.delete(id);
    }
    for (const prompt of saved.snapshot.prompts) {
      prompts.set(prompt.id, prompt);
      // A saved edit of a library prompt stays a library prompt, so selections still apply to it.
      origins.set(prompt.id, pristine.origins.get(prompt.id) ?? { kind: 'runtime' });
    }
    this.shared.prompts = prompts;
    this.shared.origins = origins;
    return saved.snapshot.prompts.length;
  }

  /**
   * Reads the backend again if it changed since it was last read. Reads of the store are
   * synchronous, so a backend that can only answer asynchronously is asked in the background:
   * this starts a check when the interval has passed and returns at once, and what the check
   * finds is served from the next read on.
   */
  private refresh(): void {
    const { backend, saved } = this.shared;
    if (!backend || !saved) return;
    if (this.shared.asyncBackend) {
      if (!this.shared.checking && Date.now() - this.shared.lastCheck >= this.shared.refreshMs) void this.runCheck();
      return;
    }
    const revision = backend.revision();
    if (typeof revision !== 'string') {
      Promise.resolve(revision).catch(() => undefined);
      return;
    }
    if (revision === saved.revision) return;
    let snapshot: StateSnapshot | Promise<StateSnapshot>;
    try {
      snapshot = backend.load();
    } catch (err) {
      logger.warn({ err }, 'Could not read the saved prompts again; serving what was read before');
      return;
    }
    if (snapshot instanceof Promise) {
      snapshot.catch(() => undefined);
      return;
    }
    this.shared.saved = { snapshot, revision };
    this.applySaved();
  }

  /** Runs one check of an asynchronous backend, or joins the one that is running. */
  private runCheck(): Promise<void> {
    const shared = this.shared;
    if (!shared.checking) {
      shared.lastCheck = Date.now();
      shared.checking = this.checkBackend().finally(() => {
        shared.checking = undefined;
      });
    }
    return shared.checking;
  }

  /** Compares the backend's revision with the one last read, and reads it again if it moved. Never throws. */
  private async checkBackend(): Promise<void> {
    const shared = this.shared;
    // A change made through this store while the backend was being read is not in what was read,
    // and applying that would take it out of memory: read again instead.
    for (let attempt = 0; attempt < 3; attempt++) {
      const { backend, saved, writes } = shared;
      if (!backend || !saved) return;
      try {
        // Bounded, so that a backend that never answers fails this check and the next one can start.
        const revision = await withTimeout(backend.revision(), shared.checkTimeoutMs);
        if (revision !== saved.revision) {
          const snapshot = await withTimeout(backend.load(), shared.checkTimeoutMs);
          if (shared.writes !== writes) continue;
          shared.saved = { snapshot, revision };
          this.applySaved();
        }
        if (shared.checkFailed) logger.info('The saved prompts can be read again');
        shared.checkFailed = false;
        return;
      } catch (error) {
        // PromptStorageError messages carry no connection details; anything else is named by its type only.
        if (!shared.checkFailed) {
          const reason = error instanceof PromptStorageError ? error.message : error instanceof Error ? error.name : 'error';
          logger.warn(`Could not check the saved prompts for changes (${reason}); serving what was read before`);
        }
        shared.checkFailed = true;
        return;
      }
    }
  }

  private assertWritable(): void {
    if (this.shared.backend && !this.shared.backend.writable) {
      throw new PromptUsageError(this.shared.backend.kind === 'file'
        ? 'This server reads its state directory read-only, so prompts cannot be changed here'
        : 'This server reads its database read-only, so prompts cannot be changed here');
    }
  }

  /**
   * Saves a change to the backend. Callers await it only when there is a backend, so a store that
   * keeps changes in memory decides and applies a change in one step. A failure the backend did not word itself
   * (a driver error, which may carry connection details) becomes a PromptStorageError that says
   * nothing was changed; the log has the cause.
   */
  private async persist(what: string, save: (backend: StateBackend) => Promise<void>): Promise<void> {
    const backend = this.shared.backend!;
    try {
      await save(backend);
    } catch (error) {
      // Someone else changed the prompt: read what they saved, so that trying again starts from it.
      if (error instanceof PromptStaleError && this.shared.asyncBackend) await this.sync();
      if (error instanceof PromptConflictError || error instanceof PromptStorageError || error instanceof PromptUsageError) throw error;
      logger.error({ err: error }, `Could not save ${what}`);
      throw new PromptStorageError(`Could not save ${what}; nothing was changed`);
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
    this.refresh();
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
    this.refresh();
    const prompt = this.shared.prompts.get(id);
    if (!prompt || !this.isVisible(prompt)) throw new PromptNotFoundError(id);
    return prompt;
  }

  /**
   * Runs a change to one prompt after the changes queued for the same id, so two updates of a
   * prompt cannot both start from the same version and an update cannot run after the deletion
   * it was queued behind. A failed change does not stop the ones behind it. Without a backend a
   * change is decided and applied in one step, so there is nothing to queue.
   */
  private serialised<T>(id: string, change: () => Promise<T>): Promise<T> {
    if (!this.shared.backend) return change();
    const { queued } = this.shared;
    const run = (queued.get(id) ?? Promise.resolve()).then(change, change);
    const settled = run.then(() => undefined, () => undefined);
    queued.set(id, settled);
    void settled.then(() => {
      if (queued.get(id) === settled) queued.delete(id);
    });
    return run;
  }

  async add(input: CreatePromptInput): Promise<StoredPrompt> {
    const { id: requestedId, ...fields } = input;
    const id = requestedId ?? `prompt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    return this.serialised(id, async () => {
      this.assertWritable();
      this.refresh();
      // An id taken by a prompt outside this view's selection is taken all the same.
      if (requestedId !== undefined && this.shared.prompts.has(requestedId)) throw new PromptConflictError(requestedId);
      const now = new Date().toISOString();
      const prompt: StoredPrompt = { ...fields, id, createdAt: now, updatedAt: now, version: 1 };
      // Saved first: the backend decides a conflict (another server may have saved this id a moment ago).
      if (this.shared.backend) await this.persist(`prompt ${id}`, backend => backend.put(prompt, 'create'));
      this.shared.prompts.set(id, prompt);
      this.shared.writes++;
      // An id the library also has (deleted earlier, now added again) keeps its place in the
      // library, as it will after a restart; anything else was added at runtime.
      this.shared.origins.set(id, this.shared.pristine?.origins.get(id) ?? { kind: 'runtime' });
      logger.info(`Added prompt: ${id}`);
      return prompt;
    });
  }

  async update(id: string, updates: UpdatePromptInput): Promise<StoredPrompt> {
    return this.serialised(id, async () => {
      this.assertWritable();
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
      // The backend only replaces the version this change started from; a library prompt that was
      // never saved has none, which is the null.
      const expectedVersion = prompt === this.shared.pristine?.prompts.get(id) ? null : String(prompt.version);
      if (this.shared.backend) await this.persist(`prompt ${id}`, backend => backend.put(updated, 'replace', expectedVersion));
      this.shared.prompts.set(id, updated);
      this.shared.writes++;
      logger.info(`Updated prompt: ${id}`);
      return updated;
    });
  }

  async delete(id: string): Promise<StoredPrompt> {
    return this.serialised(id, async () => {
      this.assertWritable();
      const prompt = this.get(id);
      // A prompt that also exists in the library or a user directory would come back the next time
      // the backend is read, so its id is recorded as deleted.
      const tombstone = this.shared.pristine?.prompts.has(id) ?? false;
      if (this.shared.backend) await this.persist(`the deletion of prompt ${id}`, backend => backend.remove(id, tombstone));
      this.shared.prompts.delete(id);
      this.shared.origins.delete(id);
      this.shared.writes++;
      logger.info(`Deleted prompt: ${id}`);
      return prompt;
    });
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
    const sources = { bundled: 0, catalog: 0, user: 0, session: 0 };
    for (const prompt of promptList) {
      const kind = this.originOf(prompt.id).kind;
      if (kind === 'library') sources.bundled++;
      else if (kind === 'catalog') sources.catalog++;
      else if (kind === 'user') sources.user++;
      else sources.session++;
    }
    return {
      total: promptList.length,
      templates: promptList.filter(p => p.isTemplate).length,
      regular: promptList.filter(p => !p.isTemplate).length,
      tags: Array.from(new Set(promptList.flatMap(p => p.tags || []))).sort(),
      categories: Array.from(new Set(promptList.map(categoryOf).filter((c): c is string => Boolean(c)))).sort(),
      storage: this.storage,
      sources
    };
  }

  /** The categories this store serves with their sizes, sorted by name; prompts without a category are left out. */
  categories(): CategorySummary[] {
    const rows = new Map<string, CategorySummary>();
    for (const prompt of this.all()) {
      const category = categoryOf(prompt);
      if (!category) continue;
      const row = rows.get(category) ?? { category, count: 0, templates: 0 };
      row.count++;
      if (prompt.isTemplate) row.templates++;
      rows.set(category, row);
    }
    return Array.from(rows.values()).sort((a, b) => a.category.localeCompare(b.category));
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
    this.refresh();
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
    this.refresh();
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

/** Reads at most maxBytes so a large or endless response cannot exhaust memory. */
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
