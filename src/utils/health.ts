/**
 * Health check utilities for MCP Prompts Server
 * Provides health status for the server, used by Docker and other monitoring tools
 */

import { StorageAdapter } from '../core/types.js';

/**
 * Health check result interface
 */
export interface HealthStatus {
  status: 'ok' | 'error';
  version: string;
  uptime: number;
  storage: {
    type: string;
    status: 'ok' | 'error';
    message?: string;
  };
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
    arrayBuffers: number;
  };
}

/**
 * Server start time, used to calculate uptime
 */
const startTime = Date.now();

/**
 * Get the current health status of the server
 * @param {StorageAdapter} storage Storage adapter instance
 * @param {string} storageType Storage type (file, postgres, memory)
 * @returns {Promise<HealthStatus>} Health status object
 */
export async function getHealthStatus(
  storage: StorageAdapter,
  storageType: string
): Promise<HealthStatus> {
  // Check storage connectivity
  let storageStatus: 'ok' | 'error' = 'error';
  let storageMessage: string | undefined;

  try {
    const isConnected = await storage.isConnected();
    storageStatus = isConnected ? 'ok' : 'error';
    if (!isConnected) {
      storageMessage = 'Storage is not connected';
    }
  } catch (error) {
    storageStatus = 'error';
    storageMessage = error instanceof Error ? error.message : 'Unknown storage error';
  }

  // Get memory usage
  const memoryUsage = process.memoryUsage();

  return {
    status: storageStatus === 'ok' ? 'ok' : 'error',
    version: process.env.npm_package_version || 'unknown',
    uptime: Math.floor((Date.now() - startTime) / 1000), // uptime in seconds
    storage: {
      type: storageType,
      status: storageStatus,
      message: storageMessage
    },
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // Convert to MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      external: Math.round((memoryUsage.external || 0) / 1024 / 1024),
      arrayBuffers: Math.round((memoryUsage.arrayBuffers || 0) / 1024 / 1024)
    }
  };
}

/**
 * Health check handler function that can be used by HTTP servers
 * @param {StorageAdapter} storage Storage adapter instance
 * @param {string} storageType Storage type (file, postgres, memory)
 * @returns {Function} Health check handler function
 */
export function createHealthCheckHandler(
  storage: StorageAdapter,
  storageType: string
): () => Promise<HealthStatus> {
  return async () => {
    return getHealthStatus(storage, storageType);
  };
} 