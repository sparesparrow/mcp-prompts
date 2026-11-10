import type { Catalog, ProfileSummary, Selector } from './prompt-store.js';
import { DEFAULT_OPTIONS, type ServerOptions } from './server-options.js';

// The text behind `mcp-prompts catalog` (what can be chosen) and `mcp-prompts config` (the same
// choice written as an install command, client config, URL and config file).

function pad(text: string, width: number): string {
  return text.length >= width ? `${text} ` : text + ' '.repeat(width - text.length);
}

export function formatCatalog(catalog: Catalog): string {
  const { totals } = catalog;
  const lines: string[] = [];
  lines.push(`Library: ${catalog.library ?? 'bundled sample prompts'}`);
  lines.push(
    `${totals.prompts + totals.templates} prompts (${totals.prompts} plain, ${totals.templates} templates); ` +
    `this selection serves ${totals.selectedPrompts} plain and ${totals.selectedTemplates} templates.`
  );
  lines.push('');
  const width = Math.max(10, ...catalog.groups.map(row => (row.group || '(root)').length + 2));
  lines.push(`${pad('group', width)}prompts   templates   (selected/total)`);
  for (const row of catalog.groups) {
    lines.push(
      `${pad(row.group || '(root)', width)}${pad(`${row.prompts.selected}/${row.prompts.total}`, 10)}` +
      `${row.templates.selected}/${row.templates.total}`
    );
  }
  if (catalog.tags.length > 0) {
    lines.push('', `Tags (use as tag:<tag>): ${catalog.tags.slice(0, 30).map(t => `${t.tag} (${t.count})`).join(', ')}` +
      (catalog.tags.length > 30 ? `, and ${catalog.tags.length - 30} more (--json lists all)` : ''));
  }
  lines.push('', `Served (${catalog.served.length}):`);
  const idWidth = Math.max(10, ...catalog.served.map(p => p.id.length + 2));
  for (const prompt of catalog.served) {
    const where = prompt.source === 'library' ? prompt.group || '(root)' : prompt.source === 'user' ? 'own directory' : 'added at runtime';
    lines.push(`  ${pad(prompt.id, idWidth)}${pad(prompt.template ? 'template' : 'prompt', 10)}${where}`);
  }
  lines.push('', 'Choose with --prompts, --templates and --exclude (groups, ids or tag:<tag>); see mcp-prompts --help.');
  return lines.join('\n');
}

/** The table behind `mcp-prompts profiles`: each profile, how much it serves, and what none serves. */
export function formatProfiles(listing: ProfileListing): string {
  const lines: string[] = [];
  lines.push(`Library: ${listing.library ?? 'bundled sample prompts'}`);
  if (listing.profiles.length === 0) {
    lines.push('This library defines no profiles. A profiles.json at its root adds them; see the README.');
    return lines.join('\n');
  }
  lines.push('A profile serves the prompts one kind of work needs and nothing else, so listings stay short.');
  lines.push('');
  const width = Math.max(14, ...listing.profiles.map(profile => profile.name.length + 2));
  lines.push(`${pad('profile', width)}prompts  templates  for`);
  for (const profile of listing.profiles) {
    lines.push(`${pad(profile.name, width)}${pad(String(profile.prompts), 9)}${pad(String(profile.templates), 11)}${profile.description}`);
  }
  lines.push(`${pad('(no profile)', width)}${pad(String(listing.total.prompts), 9)}${pad(String(listing.total.templates), 11)}The whole library.`);
  if (listing.unprofiled.length > 0) {
    lines.push('', `In no profile (${listing.unprofiled.length}), served only without one: ${listing.unprofiled.join(', ')}`);
  }
  lines.push(
    '',
    'Use one with --profile <name> (several: a,b), MCP_PROMPTS_PROFILE, "profile" in a config file,',
    'or ?profile=<name> in an HTTP URL. "mcp-prompts catalog --profile <name>" lists what it serves,',
    '"mcp-prompts config --profile <name>" prints the install command.',
  );
  return lines.join('\n');
}

export interface ProfileListing {
  library?: string;
  total: { prompts: number; templates: number };
  profiles: ProfileSummary[];
  unprofiled: string[];
}

function selectorValue(selector: Selector): string {
  return selector === 'all' ? 'all' : selector.length === 0 ? 'none' : selector.join(',');
}

/** The options that differ from the defaults, as command-line arguments. */
export function optionArgs(options: ServerOptions): string[] {
  const args: string[] = [];
  const { selection } = options;
  if (options.profiles.length > 0) args.push('--profile', options.profiles.join(','));
  if (selection.prompts !== 'all') args.push('--prompts', selectorValue(selection.prompts));
  if (selection.templates !== 'all') args.push('--templates', selectorValue(selection.templates));
  if (selection.exclude.length > 0) args.push('--exclude', selection.exclude.join(','));
  if (options.expose.join(',') !== DEFAULT_OPTIONS.expose.join(',')) args.push('--expose', options.expose.join(','));
  if (options.readOnly) args.push('--read-only');
  if (options.promptsDir) args.push('--prompts-dir', options.promptsDir);
  for (const dir of options.dirs) args.push('--dir', dir);
  if (options.stateDir) args.push('--state-dir', options.stateDir);
  return args;
}

/** The options that differ from the defaults, as a config file body. */
export function optionConfigFile(options: ServerOptions): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const { selection } = options;
  if (options.profiles.length > 0) config.profile = options.profiles;
  if (selection.prompts !== 'all') config.prompts = selection.prompts.length === 0 ? 'none' : selection.prompts;
  if (selection.templates !== 'all') config.templates = selection.templates.length === 0 ? 'none' : selection.templates;
  if (selection.exclude.length > 0) config.exclude = selection.exclude;
  if (options.expose.join(',') !== DEFAULT_OPTIONS.expose.join(',')) config.expose = options.expose;
  if (options.readOnly) config.readOnly = true;
  if (options.promptsDir) config.promptsDir = options.promptsDir;
  if (options.dirs.length > 0) config.dirs = options.dirs;
  if (options.stateDir) config.stateDir = options.stateDir;
  return config;
}

// Commas, colons and slashes are legal in a query string; leaving them unescaped keeps the URL readable.
function queryValue(value: string): string {
  return encodeURIComponent(value).replace(/%2C/gi, ',').replace(/%3A/gi, ':').replace(/%2F/gi, '/');
}

/** The /mcp URL that asks an HTTP-mode server for the same selection. Paths cannot go in a URL. */
export function optionUrl(options: ServerOptions, base: string): string {
  const params: string[] = [];
  const { selection } = options;
  if (options.profiles.length > 0) params.push(`profile=${queryValue(options.profiles.join(','))}`);
  if (selection.prompts !== 'all') params.push(`prompts=${queryValue(selectorValue(selection.prompts))}`);
  if (selection.templates !== 'all') params.push(`templates=${queryValue(selectorValue(selection.templates))}`);
  if (selection.exclude.length > 0) params.push(`exclude=${queryValue(selection.exclude.join(','))}`);
  if (options.expose.join(',') !== DEFAULT_OPTIONS.expose.join(',')) params.push(`expose=${queryValue(options.expose.join(','))}`);
  if (options.readOnly) params.push('readOnly=true');
  const endpoint = base.replace(/\/+$/, '').replace(/\/mcp$/, '') + '/mcp';
  return params.length > 0 ? `${endpoint}?${params.join('&')}` : endpoint;
}

/** Quotes an argument for a POSIX shell when it needs it. */
export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_\-.,:/=@%+]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

export function formatInstallSnippets(options: ServerOptions, name = 'mcp-prompts', baseUrl = 'http://localhost:3003'): string {
  const args = optionArgs(options);
  const url = optionUrl(options, baseUrl);
  const config = optionConfigFile(options);
  const command = ['claude', 'mcp', 'add', '-s', 'user', name, '--', 'mcp-prompts', ...args].map(shellQuote).join(' ');
  const stdioConfig = JSON.stringify({ mcpServers: { [name]: { command: 'mcp-prompts', args } } }, null, 2);
  const httpCommand = ['claude', 'mcp', 'add', '-s', 'user', '--transport', 'http', name, url].map(shellQuote).join(' ');
  const httpConfig = JSON.stringify({ mcpServers: { [name]: { type: 'http', url } } }, null, 2);
  const serverArgs = [
    ...(options.promptsDir ? ['--prompts-dir', options.promptsDir] : []),
    ...options.dirs.flatMap(dir => ['--dir', dir]),
    ...(options.stateDir ? ['--state-dir', options.stateDir] : []),
  ].map(shellQuote).join(' ');

  return [
    '# 1. Command: Claude Code, every project',
    command,
    '',
    '# 2. Client config: .mcp.json (one project), claude_desktop_config.json, Cursor and others',
    stdioConfig,
    '',
    `# 3. URL: an HTTP-mode server started with: mcp-prompts-http${serverArgs ? ` ${serverArgs}` : ''}`,
    ...(serverArgs ? ['#    (directories are the server\'s choice; a URL can only narrow what it serves)'] : []),
    httpCommand,
    '#    or in .mcp.json:',
    httpConfig,
    '',
    '# 4. Config file: save as mcp-prompts.json and start with: mcp-prompts --config /absolute/path/mcp-prompts.json',
    JSON.stringify(config, null, 2),
  ].join('\n');
}
