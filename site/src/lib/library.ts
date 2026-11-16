// The prompt library as the server sees it: which files are prompts, their groups, the
// profiles, and which prompts a choice of profiles and selection serves. It mirrors
// src/prompt-store.ts (loadTree, checkPromptData, loadProfiles, matchesEntry, selectionFilter,
// selectProfiles), and scripts/verify.ts checks it against the real server.
//
// Plain TypeScript with no DOM or Node APIs, so the page and the Node scripts share it.

/** 'all', or entries that match a group, an id or tag:<name>. An empty list selects nothing. */
export type Selector = 'all' | string[];

export interface Selection {
  prompts: Selector;
  templates: Selector;
  exclude: string[];
}

export const SELECT_ALL: Selection = { prompts: 'all', templates: 'all', exclude: [] };

export interface LibraryPrompt {
  id: string;
  name: string;
  description?: string;
  isTemplate: boolean;
  tags: string[];
  category?: string;
  /** Variable names of a template, in file order. */
  variables: string[];
  /** Directory relative to the library root, with / separators; '' for files at the root. */
  group: string;
  /** Present when the page loaded the live library; the snapshot leaves it out. */
  content?: string;
}

export interface Profile {
  name: string;
  description: string;
  selection: Selection;
}

export interface Library {
  prompts: LibraryPrompt[];
  profiles: Profile[];
  /** Package version, from package.json. */
  version?: string;
  /** Files the server would skip, with the reason. */
  skipped: Array<{ path: string; reason: string }>;
}

/** The library as built into the page, for when the live one cannot be read. */
export interface Snapshot extends Library {
  version: string;
}

const NOT_PROMPTS = ['index.json', 'profiles.json'];

/**
 * Whether a path relative to the library root is a prompt file the server reads: a .json file,
 * not index.json or profiles.json, with no hidden segment.
 */
export function isPromptPath(relativePath: string): boolean {
  const segments = relativePath.split('/');
  const name = segments[segments.length - 1];
  return (
    name.endsWith('.json') &&
    !NOT_PROMPTS.includes(name) &&
    segments.every(segment => segment !== '' && !segment.startsWith('.'))
  );
}

/** The group of a prompt file: its directory relative to the library root. */
export function groupOf(relativePath: string): string {
  const segments = relativePath.split('/');
  return segments.slice(0, -1).join('/');
}

// The server walks each directory in name order (plain < comparison) and descends as it goes,
// which is the same as comparing paths segment by segment.
export function compareLoadOrder(a: string, b: string): number {
  const left = a.split('/');
  const right = b.split('/');
  for (let i = 0; i < Math.min(left.length, right.length); i++) {
    if (left[i] !== right[i]) return left[i] < right[i] ? -1 : 1;
  }
  return left.length - right.length;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const optional = (value: unknown, check: (v: unknown) => boolean) => value === undefined || check(value);
const isString = (v: unknown) => typeof v === 'string';
const isStringArray = (v: unknown) => Array.isArray(v) && v.every(isString);

/**
 * Checks a prompt file as the server's PromptFileSchema does and returns the prompt, or the
 * reason the server would skip the file.
 */
export function parsePromptFile(raw: unknown, relativePath: string): LibraryPrompt | { error: string } {
  if (!isRecord(raw)) return { error: 'not a JSON object' };
  if (typeof raw.id !== 'string' || raw.id.length === 0) return { error: 'id: expected a non-empty string' };
  if (typeof raw.name !== 'string' || raw.name.length === 0) return { error: 'name: expected a non-empty string' };
  if (typeof raw.content !== 'string') return { error: 'content: expected a string' };
  const checks: Array<[string, boolean]> = [
    ['description', optional(raw.description, isString)],
    ['isTemplate', optional(raw.isTemplate, v => typeof v === 'boolean')],
    ['tags', optional(raw.tags, isStringArray)],
    ['category', optional(raw.category, isString)],
    ['variables', optional(raw.variables, v => Array.isArray(v) && v.every(item => isString(item) || (isRecord(item) && isString(item.name))))],
    ['metadata', optional(raw.metadata, isRecord)],
    ['version', optional(raw.version, v => typeof v === 'number' || typeof v === 'string')],
    ['createdAt', optional(raw.createdAt, isString)],
    ['updatedAt', optional(raw.updatedAt, isString)],
  ];
  const failed = checks.find(([, ok]) => !ok);
  if (failed) return { error: `${failed[0]}: unexpected type` };
  const variables = ((raw.variables as unknown[] | undefined) ?? []).map(item =>
    typeof item === 'string' ? item : String((item as { name: string }).name)
  );
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description as string | undefined,
    isTemplate: (raw.isTemplate as boolean | undefined) ?? false,
    tags: (raw.tags as string[] | undefined) ?? [],
    category: raw.category as string | undefined,
    variables,
    group: groupOf(relativePath),
    content: raw.content,
  };
}

/**
 * Builds the library from prompt files (path relative to the library root → parsed JSON) the
 * way the server loads them: in load order, a later file with the same id replacing an earlier
 * one in place.
 */
export function buildPrompts(files: Array<{ path: string; data: unknown }>): {
  prompts: LibraryPrompt[];
  skipped: Library['skipped'];
} {
  const byId = new Map<string, LibraryPrompt>();
  const skipped: Library['skipped'] = [];
  const ordered = files.filter(file => isPromptPath(file.path)).sort((a, b) => compareLoadOrder(a.path, b.path));
  for (const file of ordered) {
    const parsed = parsePromptFile(file.data, file.path);
    if ('error' in parsed) {
      skipped.push({ path: file.path, reason: parsed.error });
      continue;
    }
    byId.set(parsed.id, parsed);
  }
  return { prompts: Array.from(byId.values()), skipped };
}

const PROFILE_NAME = /^[a-z0-9][a-z0-9-]*$/;

function profileSelector(value: unknown): Selector | undefined {
  if (value === undefined || value === 'all') return 'all';
  if (value === 'none') return [];
  if (Array.isArray(value) && value.every(item => typeof item === 'string' && item.length > 0)) return value as string[];
  return undefined;
}

/**
 * Reads profiles.json as the server does. The server ignores the whole file when any part of
 * it is invalid, and so does this.
 */
export function parseProfiles(raw: unknown): Profile[] {
  if (!isRecord(raw) || !isRecord(raw.profiles)) return [];
  const profiles: Profile[] = [];
  for (const [name, value] of Object.entries(raw.profiles)) {
    if (!PROFILE_NAME.test(name) || !isRecord(value)) return [];
    const known = ['description', 'prompts', 'templates', 'exclude'];
    if (Object.keys(value).some(key => !known.includes(key))) return [];
    const prompts = profileSelector(value.prompts);
    const templates = profileSelector(value.templates);
    const exclude = value.exclude ?? [];
    if (
      prompts === undefined ||
      templates === undefined ||
      !optional(value.description, isString) ||
      !(Array.isArray(exclude) && exclude.every(item => typeof item === 'string' && item.length > 0))
    ) {
      return [];
    }
    profiles.push({
      name,
      description: (value.description as string | undefined) ?? '',
      selection: { prompts, templates, exclude: exclude as string[] },
    });
  }
  return profiles;
}

/** True when the entry (a group, an id or tag:<name>) matches the prompt. A group also matches its subgroups. */
export function matchesEntry(entry: string, prompt: Pick<LibraryPrompt, 'id' | 'tags' | 'group'>): boolean {
  if (entry.startsWith('tag:')) return prompt.tags.includes(entry.slice('tag:'.length));
  return entry === prompt.id || entry === prompt.group || prompt.group.startsWith(`${entry}/`);
}

export function selects(selection: Selection, prompt: LibraryPrompt): boolean {
  if (selection.exclude.some(entry => matchesEntry(entry, prompt))) return false;
  const selector = prompt.isTemplate ? selection.templates : selection.prompts;
  return selector === 'all' || selector.some(entry => matchesEntry(entry, prompt));
}

/**
 * The library prompts an install serves: those of any of the named profiles (all of them when
 * none is named), narrowed by the selection.
 */
export function servedPrompts(library: Pick<Library, 'prompts' | 'profiles'>, profileNames: string[], selection: Selection): LibraryPrompt[] {
  const profiles = profileNames
    .map(name => library.profiles.find(profile => profile.name === name))
    .filter((profile): profile is Profile => profile !== undefined);
  return library.prompts.filter(
    prompt =>
      (profiles.length === 0 || profiles.some(profile => selects(profile.selection, prompt))) &&
      selects(selection, prompt)
  );
}

/** Entries of a list that select nothing of their kind in the library. */
export function unmatchedEntries(library: Pick<Library, 'prompts'>, entries: string[], templates: boolean | 'any'): string[] {
  return entries.filter(
    entry =>
      !library.prompts.some(prompt => (templates === 'any' || prompt.isTemplate === templates) && matchesEntry(entry, prompt))
  );
}

export interface GroupCount {
  group: string;
  prompts: number;
  templates: number;
}

/** Each group (directory) with its plain prompts and templates, sorted by name. */
export function groupCounts(prompts: LibraryPrompt[]): GroupCount[] {
  const counts = new Map<string, GroupCount>();
  for (const prompt of prompts) {
    const row = counts.get(prompt.group) ?? { group: prompt.group, prompts: 0, templates: 0 };
    if (prompt.isTemplate) row.templates++;
    else row.prompts++;
    counts.set(prompt.group, row);
  }
  return Array.from(counts.values()).sort((a, b) => (a.group < b.group ? -1 : a.group > b.group ? 1 : 0));
}

/** Tags with how many prompts carry them, most used first. */
export function tagCounts(prompts: LibraryPrompt[]): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>();
  for (const prompt of prompts) for (const tag of prompt.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return Array.from(counts, ([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || (a.tag < b.tag ? -1 : 1));
}
