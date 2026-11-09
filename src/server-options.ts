import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { parseArgs } from 'util';
import { z } from 'zod';
import { PromptStore, SELECT_ALL, type Selection, type Selector } from './prompt-store.js';

// What an install serves: which library prompts and templates, which MCP capabilities, and whether
// prompts can be changed. The same options come from command-line flags, environment variables, a
// JSON config file and, for the HTTP /mcp endpoint, the URL's query string.

export const CAPABILITIES = ['tools', 'prompts', 'resources'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export interface ServerOptions {
  selection: Selection;
  expose: Capability[];
  readOnly: boolean;
  /** Library to choose from instead of the bundled data/prompts. */
  promptsDir?: string;
  /** The user's own directories, always served in full. */
  dirs: string[];
  /** Where add, update and delete are saved. Left out, they are kept in memory only. */
  stateDir?: string;
}

/** One source's options; keys it leaves out keep the value from an earlier source. */
export interface OptionLayer {
  prompts?: Selector;
  templates?: Selector;
  exclude?: string[];
  expose?: Capability[];
  readOnly?: boolean;
  promptsDir?: string;
  dirs?: string[];
  stateDir?: string;
}

export const DEFAULT_OPTIONS: ServerOptions = {
  selection: SELECT_ALL,
  expose: ['tools'],
  readOnly: false,
  dirs: [],
};

/** An option value or name is invalid; the message says which and why. */
export class OptionsError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export const HELP_TEXT = `Usage:
  mcp-prompts [options]                 serve MCP over stdio (what MCP clients start)
  mcp-prompts catalog [options] [--json]
                                        list the library's groups and what the options select
  mcp-prompts config [options] [--name <server>] [--url <base url>]
                                        print the install command, client config, URL and config
                                        file that serve what the options select
  mcp-prompts-http [options]            serve the HTTP API, with MCP at /mcp

Choose what the install serves:
  --prompts <list>      plain prompts to serve (default: all)
  --templates <list>    templates to serve (default: all)
  --exclude <list>      entries to leave out of both lists
                        A list is comma-separated: all, none, a group (a directory of the
                        library, such as mia-car; cognitive also covers cognitive/meta),
                        a prompt id, or tag:<tag>. Run "mcp-prompts catalog" to see them.
  --expose <list>       MCP capabilities: tools, prompts, resources (default: tools)
                        prompts makes each prompt a slash command; resources makes each one
                        readable as prompts://<id>
  --read-only           leave out add_prompt, update_prompt and delete_prompt
  --prompts-dir <dir>   library to choose from instead of the bundled prompts
  --dir <dir>           also serve every prompt in this directory, unfiltered (repeatable)
  --state-dir <dir>     save add_prompt, update_prompt and delete_prompt to this directory and
                        load them again at the next start (default: memory only)
  --config <file>       read options from a JSON file (keys: prompts, templates, exclude,
                        expose, readOnly, promptsDir, dirs, stateDir)
  -h, --help            show this help
  -v, --version         show the version

Environment variables: MCP_PROMPTS_PROMPTS, MCP_PROMPTS_TEMPLATES, MCP_PROMPTS_EXCLUDE,
MCP_PROMPTS_EXPOSE, MCP_PROMPTS_READ_ONLY, PROMPTS_DIR, MCP_PROMPTS_DIRS (separated by
"${path.delimiter}"), MCP_PROMPTS_STATE_DIR, MCP_PROMPTS_CONFIG. Flags override environment
variables, which override the config file.

HTTP: the URL http://<host>:<port>/mcp takes prompts, templates, exclude, expose and readOnly as
query parameters, and can only narrow what the server itself serves.
mcp-prompts-http also reads HOST (default 127.0.0.1), PORT (default 3003), CORS_ORIGIN and:
  MCP_PROMPTS_AUTH_TOKEN        bearer token every request except /health, /ready and /version
                                must carry (or MCP_PROMPTS_AUTH_TOKEN_FILE, a file holding it)
  MCP_PROMPTS_ALLOWED_HOSTS     Host header names to accept (default: loopback names when HOST
                                is loopback, otherwise unchecked)
  MCP_PROMPTS_ALLOWED_ORIGINS   browser origins to accept besides CORS_ORIGIN
A server that listens beyond loopback and accepts writes must have a token; without one it
refuses to start unless it is read-only or MCP_PROMPTS_ALLOW_INSECURE=true.
`;

function splitEntries(values: string | readonly string[]): string[] {
  return (typeof values === 'string' ? [values] : values)
    .flatMap(value => value.split(','))
    .map(entry => entry.trim())
    .filter(Boolean);
}

/** Parses a prompts or templates list: all, none, or groups, ids and tag:<tag> entries. */
export function parseSelector(name: string, values: string | readonly string[]): Selector {
  const entries = splitEntries(values);
  if (entries.length === 0) throw new OptionsError(`${name} needs at least one entry (use none to serve nothing)`);
  for (const keyword of ['all', 'none']) {
    if (entries.includes(keyword) && entries.length > 1) {
      throw new OptionsError(`${name}: ${keyword} cannot be combined with other entries`);
    }
  }
  const emptyTag = entries.find(entry => entry === 'tag:');
  if (emptyTag) throw new OptionsError(`${name}: tag: needs a tag name, as in tag:voice`);
  if (entries[0] === 'all') return 'all';
  if (entries[0] === 'none') return [];
  return Array.from(new Set(entries));
}

function parseExclude(values: string | readonly string[]): string[] {
  const entries = splitEntries(values);
  if (entries.includes('tag:')) throw new OptionsError('exclude: tag: needs a tag name, as in tag:voice');
  return Array.from(new Set(entries));
}

export function parseExpose(values: string | readonly string[]): Capability[] {
  const entries = splitEntries(values);
  if (entries.length === 0) throw new OptionsError(`expose needs at least one of ${CAPABILITIES.join(', ')}`);
  const unknown = entries.filter(entry => !(CAPABILITIES as readonly string[]).includes(entry));
  if (unknown.length > 0) {
    throw new OptionsError(`expose: unknown capability ${unknown.join(', ')} (expected ${CAPABILITIES.join(', ')})`);
  }
  // Keep a stable order so equal choices print the same way.
  return CAPABILITIES.filter(capability => entries.includes(capability));
}

function parseBoolean(name: string, value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  throw new OptionsError(`${name} must be true or false, not "${value}"`);
}

/** Expands a leading ~ and resolves relative paths against base. */
export function resolvePath(value: string, base: string): string {
  const expanded = value === '~' || value.startsWith('~/') || value.startsWith(`~${path.sep}`)
    ? path.join(os.homedir(), value.slice(1))
    : value;
  return path.resolve(base, expanded);
}

export interface CommandLine {
  /** The subcommand (catalog, config), or undefined to serve. */
  command?: string;
  layer: OptionLayer;
  configPath?: string;
  help: boolean;
  version: boolean;
  json: boolean;
  name?: string;
  url?: string;
}

const ARG_OPTIONS = {
  prompts: { type: 'string', multiple: true },
  templates: { type: 'string', multiple: true },
  exclude: { type: 'string', multiple: true },
  expose: { type: 'string', multiple: true },
  'read-only': { type: 'boolean' },
  'prompts-dir': { type: 'string' },
  dir: { type: 'string', multiple: true },
  'state-dir': { type: 'string' },
  config: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  json: { type: 'boolean' },
  name: { type: 'string' },
  url: { type: 'string' },
} as const;

/** Parses command-line arguments (without the node and script paths). Paths resolve against cwd. */
export function parseCommandLine(argv: readonly string[], cwd: string = process.cwd()): CommandLine {
  let parsed;
  try {
    parsed = parseArgs({ args: [...argv], options: ARG_OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    // parseArgs appends advice about '--' that does not apply here; keep the first sentence.
    const message = error instanceof Error ? error.message : String(error);
    throw new OptionsError(message.split('. ')[0]);
  }
  const { values, positionals } = parsed;
  if (positionals.length > 1) throw new OptionsError(`unexpected argument "${positionals[1]}"`);

  const layer: OptionLayer = {};
  if (values.prompts) layer.prompts = parseSelector('prompts', values.prompts);
  if (values.templates) layer.templates = parseSelector('templates', values.templates);
  if (values.exclude) layer.exclude = parseExclude(values.exclude);
  if (values.expose) layer.expose = parseExpose(values.expose);
  if (values['read-only']) layer.readOnly = true;
  if (values['prompts-dir']) layer.promptsDir = resolvePath(values['prompts-dir'], cwd);
  if (values.dir) layer.dirs = values.dir.map(dir => resolvePath(dir, cwd));
  if (values['state-dir']) layer.stateDir = resolvePath(values['state-dir'], cwd);

  return {
    command: positionals[0],
    layer,
    configPath: values.config ? resolvePath(values.config, cwd) : undefined,
    help: Boolean(values.help),
    version: Boolean(values.version),
    json: Boolean(values.json),
    name: values.name,
    url: values.url,
  };
}

const ENV_KEYS = [
  'MCP_PROMPTS_PROMPTS', 'MCP_PROMPTS_TEMPLATES', 'MCP_PROMPTS_EXCLUDE', 'MCP_PROMPTS_EXPOSE',
  'MCP_PROMPTS_READ_ONLY', 'MCP_PROMPTS_DIRS', 'MCP_PROMPTS_STATE_DIR', 'MCP_PROMPTS_CONFIG',
  // Read by the HTTP entry point (config.ts); listed here so they are not reported as unknown.
  'MCP_PROMPTS_AUTH_TOKEN', 'MCP_PROMPTS_AUTH_TOKEN_FILE', 'MCP_PROMPTS_ALLOWED_HOSTS',
  'MCP_PROMPTS_ALLOWED_ORIGINS', 'MCP_PROMPTS_ALLOW_INSECURE',
];

// Earlier releases and the old Docker and compose files set these; no storage backend reads them.
const LEGACY_STORAGE_TYPES = ['file', 'memory'];

/** Reads the options from environment variables; an empty variable counts as unset. */
export function optionsFromEnv(
  env: NodeJS.ProcessEnv,
  cwd: string = process.cwd()
): { layer: OptionLayer; configPath?: string; warnings: string[] } {
  const get = (key: string) => (env[key]?.trim() ? env[key]!.trim() : undefined);
  const layer: OptionLayer = {};
  const prompts = get('MCP_PROMPTS_PROMPTS');
  if (prompts) layer.prompts = parseSelector('MCP_PROMPTS_PROMPTS', prompts);
  const templates = get('MCP_PROMPTS_TEMPLATES');
  if (templates) layer.templates = parseSelector('MCP_PROMPTS_TEMPLATES', templates);
  const exclude = get('MCP_PROMPTS_EXCLUDE');
  if (exclude) layer.exclude = parseExclude(exclude);
  const expose = get('MCP_PROMPTS_EXPOSE');
  if (expose) layer.expose = parseExpose(expose);
  const readOnly = get('MCP_PROMPTS_READ_ONLY');
  if (readOnly) layer.readOnly = parseBoolean('MCP_PROMPTS_READ_ONLY', readOnly);
  const promptsDir = get('PROMPTS_DIR');
  if (promptsDir) layer.promptsDir = resolvePath(promptsDir, cwd);
  const dirs = get('MCP_PROMPTS_DIRS');
  if (dirs) layer.dirs = dirs.split(path.delimiter).filter(Boolean).map(dir => resolvePath(dir, cwd));
  const stateDir = get('MCP_PROMPTS_STATE_DIR');
  if (stateDir) layer.stateDir = resolvePath(stateDir, cwd);
  const config = get('MCP_PROMPTS_CONFIG');

  // A misspelt variable would otherwise be ignored without a word.
  const warnings = Object.keys(env)
    .filter(key => key.startsWith('MCP_PROMPTS_') && !ENV_KEYS.includes(key))
    .map(key => `ignoring unknown environment variable ${key}`);

  // STORAGE_TYPE used to promise backends (postgres, aws) this server does not have; saying nothing
  // let a deployment believe its prompts were going to a database.
  const storageType = get('STORAGE_TYPE');
  if (storageType && !LEGACY_STORAGE_TYPES.includes(storageType)) {
    warnings.push(`STORAGE_TYPE=${storageType} is not supported: prompts are read from files, and changes are kept in memory unless MCP_PROMPTS_STATE_DIR is set`);
  } else if (storageType === 'file' && !layer.stateDir) {
    warnings.push('STORAGE_TYPE=file no longer selects anything: set MCP_PROMPTS_STATE_DIR to save changes to disk');
  }

  return { layer, configPath: config ? resolvePath(config, cwd) : undefined, warnings };
}

const StringOrList = z.union([z.string(), z.array(z.string())]);

const ConfigFileSchema = z.strictObject({
  $schema: z.string().optional(),
  prompts: StringOrList.optional(),
  templates: StringOrList.optional(),
  exclude: StringOrList.optional(),
  expose: StringOrList.optional(),
  readOnly: z.boolean().optional(),
  promptsDir: z.string().optional(),
  dirs: z.array(z.string()).optional(),
  stateDir: z.string().optional(),
});

/** Reads a JSON config file. Relative paths in it resolve against the file's directory. */
export function optionsFromConfigFile(file: string): OptionLayer {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new OptionsError(`cannot read config file ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const parsed = ConfigFileSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map(issue => {
      const where = issue.path.length > 0 ? issue.path.join('.') : 'file';
      return `${where}: ${issue.message}`;
    });
    throw new OptionsError(`config file ${file}: ${problems.join('; ')}`);
  }
  const config = parsed.data;
  const base = path.dirname(file);
  const layer: OptionLayer = {};
  if (config.prompts !== undefined) layer.prompts = parseSelector('prompts', config.prompts);
  if (config.templates !== undefined) layer.templates = parseSelector('templates', config.templates);
  if (config.exclude !== undefined) layer.exclude = parseExclude(config.exclude);
  if (config.expose !== undefined) layer.expose = parseExpose(config.expose);
  if (config.readOnly !== undefined) layer.readOnly = config.readOnly;
  if (config.promptsDir !== undefined) layer.promptsDir = resolvePath(config.promptsDir, base);
  if (config.dirs !== undefined) layer.dirs = config.dirs.map(dir => resolvePath(dir, base));
  if (config.stateDir !== undefined) layer.stateDir = resolvePath(config.stateDir, base);
  return layer;
}

export const QUERY_PARAMS = ['prompts', 'templates', 'exclude', 'expose', 'readOnly'] as const;

/**
 * Reads the options a /mcp URL may carry. Paths are not among them: a URL chooses from what the
 * server already loaded and never reaches its filesystem.
 */
export function optionsFromQuery(query: URLSearchParams): OptionLayer {
  const unknown = Array.from(new Set(query.keys())).filter(key => !(QUERY_PARAMS as readonly string[]).includes(key));
  if (unknown.length > 0) {
    throw new OptionsError(`unknown query parameter ${unknown.join(', ')} (accepted: ${QUERY_PARAMS.join(', ')})`);
  }
  const layer: OptionLayer = {};
  if (query.has('prompts')) layer.prompts = parseSelector('prompts', query.getAll('prompts'));
  if (query.has('templates')) layer.templates = parseSelector('templates', query.getAll('templates'));
  if (query.has('exclude')) layer.exclude = parseExclude(query.getAll('exclude'));
  if (query.has('expose')) layer.expose = parseExpose(query.getAll('expose'));
  const readOnly = query.getAll('readOnly');
  if (readOnly.length > 0) layer.readOnly = readOnly.some(value => parseBoolean('readOnly', value));
  return layer;
}

/** Applies layers in order; each overrides the keys it sets. */
export function mergeOptions(base: ServerOptions, ...layers: OptionLayer[]): ServerOptions {
  const result: ServerOptions = { ...base, selection: { ...base.selection }, expose: [...base.expose], dirs: [...base.dirs] };
  for (const layer of layers) {
    if (layer.prompts !== undefined) result.selection.prompts = layer.prompts;
    if (layer.templates !== undefined) result.selection.templates = layer.templates;
    if (layer.exclude !== undefined) result.selection.exclude = layer.exclude;
    if (layer.expose !== undefined) result.expose = layer.expose;
    if (layer.readOnly !== undefined) result.readOnly = layer.readOnly;
    if (layer.promptsDir !== undefined) result.promptsDir = layer.promptsDir;
    if (layer.dirs !== undefined) result.dirs = layer.dirs;
    if (layer.stateDir !== undefined) result.stateDir = layer.stateDir;
  }
  return result;
}

export interface ResolvedOptions {
  options: ServerOptions;
  commandLine: CommandLine;
  warnings: string[];
}

/** Resolves the options from the config file, then the environment, then the command line. */
export function resolveOptions(
  argv: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): ResolvedOptions {
  const commandLine = parseCommandLine(argv, cwd);
  const fromEnv = optionsFromEnv(env, cwd);
  const configPath = commandLine.configPath ?? fromEnv.configPath;
  const fromFile = configPath ? optionsFromConfigFile(configPath) : {};
  return {
    options: mergeOptions(DEFAULT_OPTIONS, fromFile, fromEnv.layer, commandLine.layer),
    commandLine,
    warnings: fromEnv.warnings,
  };
}

/**
 * Loads the library, the user's directories and what earlier runs saved to the state directory,
 * and selects what the options ask for. Throws PromptStorageError when the state directory cannot
 * be written and the options are not read-only.
 */
export function openStore(options: ServerOptions): { base: PromptStore; store: PromptStore; warnings: string[] } {
  const base = new PromptStore();
  base.load({ promptsDir: options.promptsDir, dirs: options.dirs });
  if (options.stateDir) base.openStateDir(options.stateDir, { readOnly: options.readOnly });
  return { base, store: base.select(options.selection), warnings: base.selectionWarnings(options.selection) };
}
