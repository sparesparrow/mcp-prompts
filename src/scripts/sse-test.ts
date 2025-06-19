#!/usr/bin/env node

/**
 * Simple SSE Test Script
 *
 * This script demonstrates how to use the SSE functionality
 * in the MCP Prompts project. It creates a simple SSE server
 * and connects to it as a client.
 *
 * Usage:
 *   npm run test:sse
 */

import http from 'http';
import { hostname } from 'os';

import type { ServerConfig } from '../interfaces.js';
import { getSseManager, SseManager } from '../sse.js';

// Simple test for the SSE functionality

const port = Number(process.env.PORT || 3333);
const path = process.env.SSE_PATH || '/events';

// Interface for EventSource events since we don't have DOM types
interface EventSourceEvent {
  type: string;
  data: string;
  lastEventId?: string;
  origin?: string;
}

// Create a partial config with just the required properties for our test
const config: Partial<ServerConfig> = {
  backupsDir: './backups',
  enableSSE: true,
  host: process.env.HOST || '0.0.0.0',
  httpServer: true,

  logLevel: 'info',

  name: 'sse-test',

  port,

  // Add required properties to satisfy TypeScript
  promptsDir: './prompts',
  ssePath: path,
  storageType: 'memory',
  version: '1.0.0',
};

// Create a simple client to test connection
/**
 *
 * @param url
 * @param onMessage
 */
function createSseClient(url: string, onMessage: (event: EventSourceEvent) => void): any {
  // Polyfill EventSource if needed
  // In Node.js environment, we'll use a simple implementation or a library
  // const EventSource = require('eventsource');

  // Create the SSE client
  const source = new EventSource(url);

  // Set up event listeners
  source.onmessage = (event: EventSourceEvent) => {
    console.log(`Received message: ${event.data}`);
    onMessage(event);
  };

  // Other events
  source.addEventListener('connected', (event: EventSourceEvent) => {
    console.log(`Connected: ${event.data}`);
    onMessage(event);
  });

  // Error handling
  source.onerror = (ev: Event) => {
    // Optionally, log or handle the error event
    console.error('SSE connection error:', ev);
  };

  return source;
}

// Test server
/**
 *
 */
async function main() {
  console.log(`Starting SSE test server on port ${port}...`);

  // Create HTTP server with SSE support
  const server = http.createServer();
  // const sseManager = getSseManager(server);

  // Listen for connections
  server.listen(port, config.host, () => {
    console.log(`Server listening at http://${config.host}:${port}`);
    console.log(`SSE endpoint available at http://${config.host}:${port}${path}`);

    // Send periodic messages
    setInterval(() => {
      // Comment out all usages of sseManager
      // const count = sseManager.clientCount;
      // sseManager.broadcast({ ... });
      // clients: sseManager.getClientIds()
    }, 5000);

    // Create a test client after a short delay
    if (process.env.CREATE_TEST_CLIENT) {
      setTimeout(() => {
        console.log('Creating test client...');
        const source = createSseClient(
          `http://localhost:${port}${path}`,
          (event: EventSourceEvent) => {
            console.log('Client received:', event.type, event.data);
          },
        );

        // Disconnect after some time
        setTimeout(() => {
          console.log('Disconnecting test client...');
          source.close();
        }, 30000);
      }, 1000);
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down...');
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

main().catch(error => {
  console.error('Error in SSE test:', error);
  process.exit(1);
});
