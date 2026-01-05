// esp32-bridge.ts
// Main entry point for ESP32 bridge service
// Provides both MCP stdio server and HTTP REST API for ESP32 communication

import pino from 'pino';
import { ESP32MCPServer } from './mcp/esp32-mcp-server.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

// Default ESP32 configuration
const DEFAULT_CONFIG = {
  port: process.env.ESP32_SERIAL_PORT || '/dev/ttyUSB0',
  baudRate: parseInt(process.env.ESP32_BAUD_RATE || '115200'),
  deviceId: process.env.ESP32_DEVICE_ID || 'esp32-001',
  autoReconnect: process.env.ESP32_AUTO_RECONNECT !== 'false',
  reconnectInterval: parseInt(process.env.ESP32_RECONNECT_INTERVAL || '5000'),
  messageTimeout: parseInt(process.env.ESP32_MESSAGE_TIMEOUT || '5000')
};

/**
 * Validate ESP32 configuration
 */
function validateConfig(config: any): boolean {
  if (!config.port) {
    logger.error('ESP32_SERIAL_PORT is required');
    return false;
  }

  if (!config.deviceId) {
    logger.error('ESP32_DEVICE_ID is required');
    return false;
  }

  if (config.baudRate < 9600 || config.baudRate > 1000000) {
    logger.error('ESP32_BAUD_RATE must be between 9600 and 1000000');
    return false;
  }

  return true;
}

/**
 * Main entry point
 */
async function main() {
  logger.info('Starting ESP32 Bridge Service');

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

      case 'http':
        await runHTTPServer();
        break;

      default:
        logger.error(`Unknown mode: ${mode}. Use MODE=mcp or MODE=http`);
        process.exit(1);
    }

  } catch (error) {
    logger.error('ESP32 Bridge failed to start:', error);
    process.exit(1);
  }
}

/**
 * Run MCP stdio server
 */
async function runMCPServer() {
  logger.info('Starting ESP32 MCP Server mode');

  const server = new ESP32MCPServer(DEFAULT_CONFIG);

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

/**
 * Run HTTP REST API server (future implementation)
 */
async function runHTTPServer() {
  logger.info('HTTP server mode not yet implemented');
  logger.info('Use MODE=mcp for MCP stdio server');
  process.exit(1);
}

// Start the service
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start ESP32 Bridge:', error);
    process.exit(1);
  });
}