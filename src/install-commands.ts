import type { Catalog, Selector } from './prompt-store.js';
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

function selectorValue(selector: Selector): string {
  return selector === 'all' ? 'all' : selector.length === 0 ? 'none' : selector.join(',');
}

/** The options that differ from the defaults, as command-line arguments. */
export function optionArgs(options: ServerOptions): string[] {
  const args: string[] = [];
  const { selection } = options;
  if (selection.prompts !== 'all') args.push('--prompts', selectorValue(selection.prompts));
  if (selection.templates !== 'all') args.push('--templates', selectorValue(selection.templates));
  if (selection.exclude.length > 0) args.push('--exclude', selection.exclude.join(','));
  if (options.expose.join(',') !== DEFAULT_OPTIONS.expose.join(',')) args.push('--expose', options.expose.join(','));
  if (options.readOnly) args.push('--read-only');
  if (options.promptsDir) args.push('--prompts-dir', options.promptsDir);
  for (const dir of options.dirs) args.push('--dir', dir);
  return args;
}

/** The options that differ from the defaults, as a config file body. */
export function optionConfigFile(options: ServerOptions): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const { selection } = options;
  if (selection.prompts !== 'all') config.prompts = selection.prompts.length === 0 ? 'none' : selection.prompts;
  if (selection.templates !== 'all') config.templates = selection.templates.length === 0 ? 'none' : selection.templates;
  if (selection.exclude.length > 0) config.exclude = selection.exclude;
  if (options.expose.join(',') !== DEFAULT_OPTIONS.expose.join(',')) config.expose = options.expose;
  if (options.readOnly) config.readOnly = true;
  if (options.promptsDir) config.promptsDir = options.promptsDir;
  if (options.dirs.length > 0) config.dirs = options.dirs;
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
