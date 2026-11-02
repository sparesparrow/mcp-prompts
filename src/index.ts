#!/usr/bin/env node
// HTTP entry point (MODE=http). The MCP stdio server is mcp-server-standalone.ts.
// Takes the same options as `mcp-prompts` (flags, environment, --config file); see server-options.ts.
import { loadConfig } from './config.js';
import { startHttpServer } from './http-server.js';
import { HELP_TEXT, OptionsError, resolveOptions, type ResolvedOptions } from './server-options.js';
import { packageVersion } from './mcp-prompts-server.js';
import { logger } from './utils.js';

let resolved: ResolvedOptions;
try {
  resolved = resolveOptions(process.argv.slice(2));
  if (resolved.commandLine.command !== undefined) {
    throw new OptionsError(`unexpected argument "${resolved.commandLine.command}" (catalog and config are mcp-prompts commands)`);
  }
  const { json, name, url } = resolved.commandLine;
  if (json || name !== undefined || url !== undefined) {
    throw new OptionsError('--json, --name and --url go with the mcp-prompts catalog and config commands');
  }
} catch (error) {
  if (!(error instanceof OptionsError)) throw error;
  process.stderr.write(`mcp-prompts-http: ${error.message}\nRun mcp-prompts-http --help to see the options.\n`);
  process.exit(2);
}

if (resolved.commandLine.help) {
  process.stdout.write(HELP_TEXT);
} else if (resolved.commandLine.version) {
  process.stdout.write(`${packageVersion()}\n`);
} else {
  const config = loadConfig();
  for (const warning of resolved.warnings) logger.warn(warning);

  startHttpServer(config.PORT, config.HOST, { corsOrigin: config.CORS_ORIGIN, serverOptions: resolved.options })
    .then(app => {
      const shutdown = (signal: string) => {
        logger.info(`Received ${signal}, closing HTTP server`);
        app.close().then(() => process.exit(0), () => process.exit(1));
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch(error => {
      console.error('Failed to start HTTP server:', error);
      process.exit(1);
    });
}
