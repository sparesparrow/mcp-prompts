#!/usr/bin/env node

import { SseClientTransport } from '@modelcontextprotocol/sdk/dist/esm/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/dist/esm/client/index.js';

console.log('Starting SSE client test...');

try {
  // The URL must include the transportType as a query parameter
  const sseUrl = 'http://localhost:3003/events?transportType=sse';
  console.log(`Connecting to SSE endpoint: ${sseUrl}`);
  
  // Create the transport with explicit transportType
  const transport = new SseClientTransport(sseUrl);
  
  // Create and connect the client
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    {}
  );
  
  // Set up connection event handlers
  transport.on('connect', () => {
    console.log('Connected to SSE transport');
  });
  
  transport.on('disconnect', () => {
    console.log('Disconnected from SSE transport');
  });
  
  transport.on('error', (error) => {
    console.error('SSE transport error:', error);
  });
  
  console.log('Connecting to MCP server...');
  
  // Connect asynchronously
  client.connect(transport).then(() => {
    console.log('Connected successfully!');
    
    // Test listing prompts
    return client.prompts.list().then(result => {
      console.log('Prompts:', JSON.stringify(result, null, 2));
      
      // Keep connection alive for a while
      return new Promise(resolve => setTimeout(resolve, 10000)).then(() => {
        // Disconnect
        console.log('Disconnecting...');
        return client.disconnect().then(() => {
          console.log('Disconnected successfully');
        });
      });
    });
  }).catch(error => {
    console.error('Error during connection or operation:', error);
    process.exit(1);
  });
  
} catch (error) {
  console.error('Error setting up client:', error);
  process.exit(1);
} 