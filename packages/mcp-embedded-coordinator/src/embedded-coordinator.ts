// embedded-coordinator.ts
// Main entry point for embedded systems coordinator
// Provides unified MCP interface for coordinating ESP32 and Android devices

import pino from 'pino';
import { EmbeddedCoordinatorServer } from './mcp/embedded-coordinator-server.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

// Default coordinator configuration
const DEFAULT_CONFIG = {
  esp32BridgeUrl: process.env.ESP32_BRIDGE_URL,
  androidBridgeUrl: process.env.ANDROID_BRIDGE_URL,
  enableSimulation: process.env.ENABLE_SIMULATION !== 'false',
  maxHistorySize: parseInt(process.env.MAX_HISTORY_SIZE || '10000')
};

/**
 * Validate coordinator configuration
 */
function validateConfig(config: any): boolean {
  // Configuration is optional - simulation will be used if no real bridges
  return true;
}

/**
 * Main entry point
 */
async function main() {
  logger.info('Starting Embedded Systems Coordinator');

  // Validate configuration
  if (!validateConfig(DEFAULT_CONFIG)) {
    process.exit(1);
  }

  // Determine run mode
  const mode = process.env.MODE || 'mcp';

  try {
    switch (mode) {
      case 'mcp':
        await runMCPServer();
        break;

      default:
        logger.error(`Unknown mode: ${mode}. Use MODE=mcp`);
        process.exit(1);
    }

  } catch (error) {
    logger.error('Failed to start Embedded Coordinator:', error);
    process.exit(1);
  }
}

/**
 * Run MCP coordinator server
 */
async function runMCPServer() {
  logger.info('Starting Embedded Coordinator MCP Server mode');

  const server = new EmbeddedCoordinatorServer(DEFAULT_CONFIG);

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
    server.stop().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    server.stop().finally(() => process.exit(1));
  });

  await server.start();
}

// Start the coordinator
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start Embedded Coordinator:', error);
    process.exit(1);
  });
}