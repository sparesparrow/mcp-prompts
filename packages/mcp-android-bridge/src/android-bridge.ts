// android-bridge.ts
// Main entry point for Android device bridge service
// Provides MCP interface for Android clipboard sync and device data access

import pino from 'pino';
import { AndroidMCPServer } from './mcp/android-mcp-server.js';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

// Default Android device configuration
const DEFAULT_CONFIG = {
  deviceId: process.env.ANDROID_DEVICE_ID || 'android-001',
  deviceName: process.env.ANDROID_DEVICE_NAME || 'Pixel 7',
  androidVersion: process.env.ANDROID_VERSION || '13.0',
  simulateClipboard: process.env.ANDROID_SIMULATE_CLIPBOARD !== 'false',
  simulateSensors: process.env.ANDROID_SIMULATE_SENSORS !== 'false',
  simulateLocation: process.env.ANDROID_SIMULATE_LOCATION !== 'false',
  clipboardUpdateInterval: parseInt(process.env.ANDROID_CLIPBOARD_INTERVAL || '30000'),
  sensorUpdateInterval: parseInt(process.env.ANDROID_SENSOR_INTERVAL || '1000'),
  locationUpdateInterval: parseInt(process.env.ANDROID_LOCATION_INTERVAL || '10000')
};

/**
 * Validate Android device configuration
 */
function validateConfig(config: any): boolean {
  if (!config.deviceId) {
    logger.error('ANDROID_DEVICE_ID is required');
    return false;
  }

  if (!config.deviceName) {
    logger.error('ANDROID_DEVICE_NAME is required');
    return false;
  }

  if (!config.androidVersion) {
    logger.error('ANDROID_VERSION is required');
    return false;
  }

  return true;
}

/**
 * Main entry point
 */
async function main() {
  logger.info('Starting Android Bridge Service');

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

      case 'websocket':
        await runWebSocketServer();
        break;

      default:
        logger.error(`Unknown mode: ${mode}. Use MODE=mcp or MODE=websocket`);
        process.exit(1);
    }

  } catch (error) {
    logger.error('Failed to start Android Bridge:', error);
    process.exit(1);
  }
}

/**
 * Run MCP stdio server
 */
async function runMCPServer() {
  logger.info('Starting Android MCP Server mode');

  const server = new AndroidMCPServer(DEFAULT_CONFIG);

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
 * Run WebSocket server for real Android device connections (future implementation)
 */
async function runWebSocketServer() {
  logger.info('WebSocket server mode not yet implemented');
  logger.info('Use MODE=mcp for MCP stdio server with device simulation');
  process.exit(1);
}

// Start the service
if (require.main === module) {
  main().catch((error) => {
    logger.error('Failed to start Android Bridge:', error);
    process.exit(1);
  });
}