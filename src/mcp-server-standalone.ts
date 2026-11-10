#!/usr/bin/env node

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { logger } from './utils.js';
import { createMcpServer, packageVersion, type McpServerOptions } from './mcp-prompts-server.js';
import { formatCatalog, formatInstallSnippets, formatProfiles, type ProfileListing } from './install-commands.js';
import { HELP_TEXT, OptionsError, openStore, resolveOptions } from './server-options.js';
import { PromptStorageError } from './prompt-store.js';

// The `mcp-prompts` binary: serves MCP over stdio, or with `catalog` / `config` shows what an install
// can serve and how to install exactly that. Options come from flags, environment variables and a
// config file (see server-options.ts).

export { createMcpServer, type McpServerOptions } from './mcp-prompts-server.js';

export async function startMcpServer(options: McpServerOptions = {}) {
  const server = await createMcpServer(options);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('MCP Prompts server started on stdio transport');
  return server;
}

const COMMANDS = ['profiles', 'catalog', 'config'];

/**
 * Runs the command line. Resolves to an exit code for commands that finish, or undefined once the
 * stdio server is serving.
 */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd()
): Promise<number | undefined> {
  let resolved;
  try {
    resolved = resolveOptions(argv, env, cwd);
    const { command, json, name, url, mode } = resolved.commandLine;
    if (command !== undefined && !COMMANDS.includes(command)) {
      throw new OptionsError(`unknown command "${command}" (commands: ${COMMANDS.join(', ')})`);
    }
    if (mode !== undefined && mode !== 'mcp') {
      throw new OptionsError(mode === 'http'
        ? '--mode http is gone: mcp-prompts serves MCP over stdio; start the HTTP server with mcp-prompts-http'
        : `unknown --mode "${mode}" (mcp-prompts serves MCP over stdio; mcp-prompts-http serves HTTP)`);
    }
    if (json && command !== 'catalog' && command !== 'profiles') throw new OptionsError('--json goes with the catalog and profiles commands');
    if ((name !== undefined || url !== undefined) && command !== 'config') {
      throw new OptionsError('--name and --url go with the config command');
    }
  } catch (error) {
    if (!(error instanceof OptionsError)) throw error;
    process.stderr.write(`mcp-prompts: ${error.message}\nRun mcp-prompts --help to see the options.\n`);
    return 2;
  }

  const { options, commandLine } = resolved;
  if (commandLine.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (commandLine.version) {
    process.stdout.write(`${packageVersion()}\n`);
    return 0;
  }

  let opened;
  try {
    opened = openStore(options);
  } catch (error) {
    if (error instanceof OptionsError) {
      // A profile the library does not have.
      process.stderr.write(`mcp-prompts: ${error.message}\nRun mcp-prompts profiles to see the profiles.\n`);
      return 2;
    }
    // The state directory cannot be written: say so in one line instead of a stack trace.
    if (!(error instanceof PromptStorageError)) throw error;
    process.stderr.write(`mcp-prompts: ${error.message}\n`);
    return 1;
  }
  const { base, store, warnings } = opened;
  const allWarnings = [...resolved.warnings, ...warnings];

  if (commandLine.command !== undefined) {
    for (const warning of allWarnings) process.stderr.write(`warning: ${warning}\n`);
    if (commandLine.command === 'profiles') {
      // The library's own profiles, whatever this command line selects.
      const { library, totals } = base.catalog();
      const listing: ProfileListing = {
        library,
        total: { prompts: totals.prompts, templates: totals.templates },
        profiles: base.profiles(),
        unprofiled: base.unprofiled(),
      };
      for (const profile of listing.profiles) {
        for (const warning of profile.warnings) process.stderr.write(`warning: profile ${profile.name}: ${warning}\n`);
      }
      process.stdout.write(`${commandLine.json ? JSON.stringify(listing, null, 2) : formatProfiles(listing)}\n`);
    } else if (commandLine.command === 'catalog') {
      process.stdout.write(`${commandLine.json ? JSON.stringify(store.catalog(), null, 2) : formatCatalog(store.catalog())}\n`);
    } else {
      process.stdout.write(`${formatInstallSnippets(options, commandLine.name, commandLine.url)}\n`);
    }
    return 0;
  }

  // stdout carries JSON-RPC from here on; warnings go to the log on stderr.
  for (const warning of allWarnings) logger.warn(warning);
  const server = await startMcpServer({ store, expose: options.expose, readOnly: options.readOnly, profiles: options.profiles });
  // As PID 1 in a container node ignores SIGTERM unless something handles it, and `docker stop`
  // would wait out its timeout and kill the process.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      server.close().then(() => process.exit(0), () => process.exit(1));
    });
  }
  return undefined;
}

// Start only when run as a program (the npm binary, node dist/..., Docker), not when imported.
if (require.main === module) {
  main().then(
    code => {
      // exitCode rather than exit(), so output piped to another program is flushed first.
      if (code !== undefined) process.exitCode = code;
    },
    error => {
      console.error('Failed to start MCP server:', error);
      process.exit(1);
    }
  );
}
