#!/usr/bin/env node
// HTTP entry point (MODE=http). The MCP stdio server is mcp-server-standalone.ts.
import { loadConfig } from './config.js';
import { startHttpServer } from './http-server.js';
import { logger } from './utils.js';

const config = loadConfig();

startHttpServer(config.PORT, config.HOST, { corsOrigin: config.CORS_ORIGIN })
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
