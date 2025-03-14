/**
 * HTTP Server for MCP Prompts Server
 * Provides health check and status endpoints
 */

import http from 'http';
import { StorageAdapter } from '../core/types.js';

interface ServerOptions {
  port: number;
  host: string;
}

/**
 * Create an HTTP server for health checks and status endpoints
 * @param storage Storage adapter instance for checking connection status
 * @param storageType Type of storage being used
 * @param options Server options including port and host
 * @returns HTTP server instance
 */
export function createHttpServer(
  storage: StorageAdapter,
  storageType: string,
  options: ServerOptions = { port: 3003, host: '0.0.0.0' }
): http.Server {
  const { port, host } = options;
  
  // Create HTTP server
  const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    
    // Only handle GET requests
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    
    // Handle different endpoints
    const url = req.url || '/';
    
    try {
      if (url === '/health' || url === '/healthz') {
        await handleHealthCheck(req, res, storage);
      } else if (url === '/status') {
        await handleStatus(req, res, storage, storageType);
      } else if (url === '/') {
        // Root endpoint with basic info
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({
          name: 'MCP Prompts Server',
          version: process.env.npm_package_version || 'development',
          status: 'running',
          endpoints: ['/health', '/healthz', '/status']
        }));
      } else {
        // Not found
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      // Internal server error
      console.error('HTTP server error:', error);
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  });
  
  // Start listening
  server.listen(port, host, () => {
    console.log(`HTTP server listening on ${host}:${port}`);
  });
  
  return server;
}

/**
 * Handle health check endpoint
 * @param req HTTP request
 * @param res HTTP response
 * @param storage Storage adapter
 */
async function handleHealthCheck(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  storage: StorageAdapter
): Promise<void> {
  let isConnected = false;
  
  try {
    // Check if storage is connected
    isConnected = await storage.isConnected();
    
    if (isConnected) {
      // All good, return 200
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'healthy' }));
    } else {
      // Storage not connected, return 503
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ 
        status: 'unhealthy',
        reason: 'Storage not connected'
      }));
    }
  } catch (error) {
    // Error checking connection, return 500
    console.error('Health check error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'error',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}

/**
 * Handle status endpoint with more detailed information
 * @param req HTTP request
 * @param res HTTP response
 * @param storage Storage adapter
 * @param storageType Type of storage being used
 */
async function handleStatus(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  storage: StorageAdapter,
  storageType: string
): Promise<void> {
  let isConnected = false;
  let promptCount = 0;
  
  try {
    // Check if storage is connected
    isConnected = await storage.isConnected();
    
    // Get prompt count if connected
    if (isConnected) {
      try {
        const prompts = await storage.getAllPrompts();
        promptCount = prompts.length;
      } catch (error) {
        console.error('Error getting prompt count:', error);
      }
    }
    
    // Return status information
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      server: {
        name: 'MCP Prompts Server',
        version: process.env.npm_package_version || 'development',
        nodeVersion: process.version,
        uptime: Math.floor(process.uptime()),
      },
      storage: {
        type: storageType,
        connected: isConnected,
        promptCount: isConnected ? promptCount : null,
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      }
    }));
  } catch (error) {
    // Error handling status, return 500
    console.error('Status endpoint error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      status: 'error',
      reason: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
} 