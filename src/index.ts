#!/usr/bin/env node

import { createServer } from './http-server';
import { startMcpServer } from './mcp-server';
import { logger } from './utils';

const PORT = parseInt(process.env.PORT || '3003', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MODE = process.env.MODE || 'http'; // 'http' or 'mcp'

async function main() {
  try {
    if (MODE === 'mcp') {
      // Start MCP server
      logger.info('Starting MCP Prompts server in MCP mode...');
      await startMcpServer();
      logger.info('MCP Prompts server started successfully');
    } else {
      // Start HTTP server
      logger.info('Starting MCP Prompts server in HTTP mode...');
      const app = await createServer();
      
      app.listen(PORT, HOST, () => {
        logger.info(`🚀 MCP Prompts Server running at http://${HOST}:${PORT}`);
        logger.info(`📚 API Documentation available at http://${HOST}:${PORT}/api-docs`);
        logger.info(`🏥 Health check available at http://${HOST}:${PORT}/health`);
      });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { createServer, startMcpServer };
