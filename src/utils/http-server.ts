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
 * Create an HTTP server for health checks
 * @param {StorageAdapter} storage Storage adapter instance
 * @param {string} storageType Storage type
 * @param {Object} options Server options
 * @param {number} options.port Server port (default: 3003)
 * @param {string} options.host Server host (default: 0.0.0.0)
 * @returns {http.Server} HTTP server instance
 */
export function createHttpServer(
  storage: StorageAdapter,
  storageType: string,
  options: { port: number; host: string }
): http.Server {
  const { port = 3003, host = '0.0.0.0' } = options;
  
  // Create HTTP server
  const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle OPTIONS requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    
    // Health check endpoint
    if (req.url === '/health' || req.url === '/') {
      try {
        // Check if storage is connected
        const isConnected = await storage.isConnected();
        
        if (isConnected) {
          const healthInfo = {
            status: 'ok',
            timestamp: new Date().toISOString(),
            storage: {
              type: storageType,
              connected: isConnected
            },
            version: process.env.npm_package_version || '1.0.0'
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(healthInfo, null, 2));
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'error',
            message: 'Storage not connected',
            timestamp: new Date().toISOString()
          }, null, 2));
        }
      } catch (error) {
        // Handle error
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }, null, 2));
      }
      return;
    }
    
    // Handle not found
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'error',
      message: 'Not found',
      timestamp: new Date().toISOString()
    }, null, 2));
  });
  
  // Start HTTP server
  server.listen(port, host);
  
  return server;
}

/**
 * Handle health check requests
 * @param {http.IncomingMessage} req HTTP request
 * @param {http.ServerResponse} res HTTP response
 * @param {StorageAdapter} storage Storage adapter
 */
async function handleHealthCheck(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  storage: StorageAdapter
): Promise<void> {
  try {
    // Check if storage is connected
    const isConnected = await storage.isConnected();
    
    // Get version information
    const version = process.env.npm_package_version || '1.0.0';
    
    // Try to get prompt count to further verify storage is working
    let promptCount = 0;
    let status = 'healthy';
    let statusMessage = 'OK';
    
    try {
      const prompts = await storage.getAllPrompts();
      promptCount = prompts.length;
    } catch (error) {
      // Storage is connected but cannot retrieve prompts
      status = 'degraded';
      statusMessage = 'Storage is connected but cannot retrieve prompts';
    }
    
    if (isConnected) {
      // Return health check response
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status,
        statusMessage,
        timestamp: new Date().toISOString(),
        version,
        uptime: Math.floor(process.uptime()),
        storage: {
          type: storage.constructor.name,
          connected: isConnected,
          promptCount
        }
      }));
    } else {
      // Storage is not connected
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'unhealthy',
        statusMessage: 'Storage is not connected',
        timestamp: new Date().toISOString(),
        version,
        uptime: Math.floor(process.uptime()),
        storage: {
          type: storage.constructor.name,
          connected: isConnected
        }
      }));
    }
  } catch (error) {
    // Error executing health check
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'error',
      statusMessage: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
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