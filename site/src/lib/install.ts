// What to paste where. optionArgs, optionConfigFile, optionUrl, shellQuote and
// formatInstallSnippets are ports of src/install-commands.ts; scripts/verify.ts compares
// formatInstallSnippets with the output of `mcp-prompts config`, so the page and the CLI agree.

import type { Selection, Selector } from './library.ts';

export const CAPABILITIES = ['tools', 'prompts', 'resources'] as const;
export type Capability = (typeof CAPABILITIES)[number];

export interface InstallOptions {
  profiles: string[];
  selection: Selection;
  expose: Capability[];
  readOnly: boolean;
  promptsDir?: string;
  dirs: string[];
  stateDir?: string;
}

export const DEFAULT_EXPOSE: Capability[] = ['tools'];

function selectorValue(selector: Selector): string {
  return selector === 'all' ? 'all' : selector.length === 0 ? 'none' : selector.join(',');
}

/** The options that differ from the defaults, as command-line arguments. */
export function optionArgs(options: InstallOptions): string[] {
  const args: string[] = [];
  const { selection } = options;
  if (options.profiles.length > 0) args.push('--profile', options.profiles.join(','));
  if (selection.prompts !== 'all') args.push('--prompts', selectorValue(selection.prompts));
  if (selection.templates !== 'all') args.push('--templates', selectorValue(selection.templates));
  if (selection.exclude.length > 0) args.push('--exclude', selection.exclude.join(','));
  if (options.expose.join(',') !== DEFAULT_EXPOSE.join(',')) args.push('--expose', options.expose.join(','));
  if (options.readOnly) args.push('--read-only');
  if (options.promptsDir) args.push('--prompts-dir', options.promptsDir);
  for (const dir of options.dirs) args.push('--dir', dir);
  if (options.stateDir) args.push('--state-dir', options.stateDir);
  return args;
}

/** The options that differ from the defaults, as a config file body. */
export function optionConfigFile(options: InstallOptions): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  const { selection } = options;
  if (options.profiles.length > 0) config.profile = options.profiles;
  if (selection.prompts !== 'all') config.prompts = selection.prompts.length === 0 ? 'none' : selection.prompts;
  if (selection.templates !== 'all') config.templates = selection.templates.length === 0 ? 'none' : selection.templates;
  if (selection.exclude.length > 0) config.exclude = selection.exclude;
  if (options.expose.join(',') !== DEFAULT_EXPOSE.join(',')) config.expose = options.expose;
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
export function optionUrl(options: InstallOptions, base: string): string {
  const params: string[] = [];
  const { selection } = options;
  if (options.profiles.length > 0) params.push(`profile=${queryValue(options.profiles.join(','))}`);
  if (selection.prompts !== 'all') params.push(`prompts=${queryValue(selectorValue(selection.prompts))}`);
  if (selection.templates !== 'all') params.push(`templates=${queryValue(selectorValue(selection.templates))}`);
  if (selection.exclude.length > 0) params.push(`exclude=${queryValue(selection.exclude.join(','))}`);
  if (options.expose.join(',') !== DEFAULT_EXPOSE.join(',')) params.push(`expose=${queryValue(options.expose.join(','))}`);
  if (options.readOnly) params.push('readOnly=true');
  const endpoint = base.replace(/\/+$/, '').replace(/\/mcp$/, '') + '/mcp';
  return params.length > 0 ? `${endpoint}?${params.join('&')}` : endpoint;
}

/** Quotes an argument for a POSIX shell when it needs it. */
export function shellQuote(arg: string): string {
  return /^[A-Za-z0-9_\-.,:/=@%+]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`;
}

/** Exactly what `mcp-prompts config` prints for these options. */
export function formatInstallSnippets(options: InstallOptions, name = 'mcp-prompts', baseUrl = 'http://localhost:3003'): string {
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

// --- The page's own forms, built on the functions above ---

export type Runner = 'global' | 'npx' | 'docker' | 'http';

export const PACKAGE = '@sparesparrow/mcp-prompts';
export const IMAGE = 'ghcr.io/sparesparrow/mcp-prompts';
/** The variable the HTTP forms read the bearer token from. */
export const TOKEN_VARIABLE = 'MCP_PROMPTS_TOKEN';

export interface Launch {
  command: string;
  args: string[];
  /** Things the reader must know for this form to work. */
  notes: string[];
}

/** How a client starts the stdio server for these options. */
export function stdioLaunch(options: InstallOptions, runner: Exclude<Runner, 'http'>, viaConfigFile = false): Launch {
  const args = viaConfigFile ? ['--config', '/absolute/path/mcp-prompts.json'] : optionArgs(options);
  if (runner === 'global') return { command: 'mcp-prompts', args, notes: [] };
  if (runner === 'npx') return { command: 'npx', args: ['-y', PACKAGE, ...args], notes: [] };

  // Docker: paths are inside the container. Own directories are mounted read-only, and the
  // :file image keeps changes in /data, a named volume, when the install saves them.
  const notes: string[] = [];
  const docker = ['run', '-i', '--rm', '--network', 'none'];
  const inner = { ...options, dirs: [] as string[], stateDir: undefined, promptsDir: undefined };
  options.dirs.forEach((dir, index) => {
    docker.push('-v', `${dir}:/own/${index + 1}:ro`);
    inner.dirs.push(`/own/${index + 1}`);
  });
  if (options.dirs.length > 0) notes.push('Docker mounts need absolute host paths for your own directories.');
  if (options.promptsDir) {
    docker.push('-v', `${options.promptsDir}:/library:ro`);
    inner.promptsDir = '/library';
  }
  if (options.stateDir) {
    docker.push('-v', 'mcp-prompts-data:/data');
    notes.push('The :file image saves changes in the mcp-prompts-data volume, not in the state directory you named.');
  }
  if (viaConfigFile) notes.push('With Docker, mount the config file and pass its path inside the container.');
  docker.push(`${IMAGE}:${options.stateDir ? 'file' : 'mcp'}`);
  return { command: 'docker', args: [...docker, ...(viaConfigFile ? args : optionArgs(inner))], notes };
}

/** One shell command line. */
export function commandLine(words: string[]): string {
  return words.map(shellQuote).join(' ');
}

export interface Snippets {
  /** Claude Code: one command that registers the server for every project. */
  claudeCode: string;
  /** .mcp.json, claude_desktop_config.json and Cursor's mcp.json. */
  mcpServersJson: string;
  /** VS Code's .vscode/mcp.json. */
  vscodeJson: string;
  /** mcp-prompts.json and how to point an install at it. */
  configFile: string;
  configFileLaunch: string;
  /** For the HTTP form: how to start the server this URL talks to. */
  server?: string;
  cursorLink: string;
  vscodeLink: string;
  notes: string[];
}

function base64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function buildSnippets(
  options: InstallOptions,
  runner: Runner,
  name: string,
  baseUrl: string,
  useToken: boolean
): Snippets {
  const configFile = JSON.stringify(optionConfigFile(options), null, 2);

  if (runner !== 'http') {
    const launch = stdioLaunch(options, runner);
    const viaFile = stdioLaunch(options, runner, true);
    const entry = { command: launch.command, args: launch.args };
    return {
      claudeCode: commandLine(['claude', 'mcp', 'add', '-s', 'user', name, '--', launch.command, ...launch.args]),
      mcpServersJson: JSON.stringify({ mcpServers: { [name]: entry } }, null, 2),
      vscodeJson: JSON.stringify({ servers: { [name]: { type: 'stdio', ...entry } } }, null, 2),
      configFile,
      configFileLaunch: JSON.stringify({ mcpServers: { [name]: { command: viaFile.command, args: viaFile.args } } }, null, 2),
      cursorLink: `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(base64(JSON.stringify(entry)))}`,
      vscodeLink: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name, ...entry }))}`,
      notes: launch.notes,
    };
  }

  // HTTP: the URL carries the selection; paths stay with the server.
  const url = optionUrl(options, baseUrl);
  const serverPaths = [
    ...(options.promptsDir ? ['--prompts-dir', options.promptsDir] : []),
    ...options.dirs.flatMap(dir => ['--dir', dir]),
    ...(options.stateDir ? ['--state-dir', options.stateDir] : []),
  ];
  const header = `Bearer \${${TOKEN_VARIABLE}}`;
  const claudeCode = [
    commandLine(['claude', 'mcp', 'add', '-s', 'user', '--transport', 'http', name, url]),
    ...(useToken ? [`--header "Authorization: Bearer $${TOKEN_VARIABLE}"`] : []),
  ].join(' ');
  const httpEntry = { type: 'http', url, ...(useToken ? { headers: { Authorization: header } } : {}) };
  const vscode = useToken
    ? {
        inputs: [{ type: 'promptString', id: 'mcp-prompts-token', description: 'mcp-prompts bearer token', password: true }],
        servers: { [name]: { type: 'http', url, headers: { Authorization: 'Bearer ${input:mcp-prompts-token}' } } },
      }
    : { servers: { [name]: { type: 'http', url } } };
  const cursorEntry = { url, ...(useToken ? { headers: { Authorization: `Bearer \${env:${TOKEN_VARIABLE}}` } } : {}) };
  const host = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return 'localhost';
    }
  })();
  const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(host);
  const tokenEnv = useToken ? [`MCP_PROMPTS_AUTH_TOKEN="$${TOKEN_VARIABLE}"`] : [];
  const hostEnv = loopback ? [] : ['HOST=0.0.0.0', `MCP_PROMPTS_ALLOWED_HOSTS=${host}`];
  const server = [
    [...tokenEnv, ...hostEnv, commandLine(['mcp-prompts-http', ...serverPaths])].join(' '),
    '',
    '# or the Docker image (read-only unless you set MCP_PROMPTS_READ_ONLY=false and a token):',
    [
      'docker run -d -p 3003:3003',
      ...(useToken ? [`-e MCP_PROMPTS_AUTH_TOKEN="$${TOKEN_VARIABLE}"`] : []),
      ...(loopback ? [] : [`-e MCP_PROMPTS_ALLOWED_HOSTS=${host}`]),
      `${IMAGE}:latest`,
    ].join(' '),
  ].join('\n');
  const notes: string[] = [];
  if (!loopback && !useToken && !options.readOnly) {
    notes.push('A server reachable beyond this machine refuses to start with writes enabled and no token: turn on read-only or use a token.');
  }
  if (useToken) notes.push(`Set ${TOKEN_VARIABLE} to the token before running these; clients send it as a bearer token.`);
  notes.push('Claude Desktop adds remote servers under Settings → Connectors, not in claude_desktop_config.json.');
  return {
    claudeCode,
    mcpServersJson: JSON.stringify({ mcpServers: { [name]: httpEntry } }, null, 2),
    vscodeJson: JSON.stringify(vscode, null, 2),
    configFile,
    configFileLaunch: commandLine(['mcp-prompts-http', '--config', '/absolute/path/mcp-prompts.json']),
    server,
    cursorLink: `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(name)}&config=${encodeURIComponent(base64(JSON.stringify(cursorEntry)))}`,
    vscodeLink: `vscode:mcp/install?${encodeURIComponent(JSON.stringify({ name, type: 'http', url }))}`,
    notes,
  };
}
