#!/usr/bin/env node
// HTTP entry point (MODE=http). The MCP stdio server is mcp-server-standalone.ts.
// Takes the same options as `mcp-prompts` (flags, environment, --config file); see server-options.ts.
import { ConfigError, loadConfig, type HttpConfig } from './config.js';
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
  let config: HttpConfig;
  try {
    config = loadConfig();
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`mcp-prompts-http: ${error.message}\nRun mcp-prompts-http --help to see the settings.\n`);
    process.exit(2);
  }
  for (const warning of resolved.warnings) logger.warn(warning);

  startHttpServer(config.port, config.host, {
    corsOrigin: config.corsOrigin,
    serverOptions: resolved.options,
    authToken: config.authToken,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins,
    allowInsecure: config.allowInsecure,
  })
    .then(app => {
      const shutdown = (signal: string) => {
        logger.info(`Received ${signal}, closing HTTP server`);
        app.close().then(() => process.exit(0), () => process.exit(1));
        // A request that never finishes must not keep the container from stopping.
        setTimeout(() => process.exit(0), 5000).unref();
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch(error => {
      // One line saying what to change, not a stack trace: this is what an operator reads first.
      process.stderr.write(`mcp-prompts-http: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exit(1);
    });
}
