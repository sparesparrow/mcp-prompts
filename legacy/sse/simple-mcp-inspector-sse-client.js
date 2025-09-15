#!/usr/bin/env node

/**
 * Simple MCP Inspector SSE Client
 * 
 * This script connects to the SSE server and logs events.
 * It acts as a simple client for the SSE server.
 */

import * as eventsource from 'eventsource';
const EventSource = eventsource.default || eventsource;
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';

// Configuration
const SSE_SERVER_URL = process.env.SSE_SERVER_URL || 'http://localhost:3004/events';
const INSPECTOR_PORT = process.env.INSPECTOR_PORT || 3005;

// Create an Express app for the Inspector server
const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Create HTTP server
const server = createServer(app);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      sse: true,
      ssePath: SSE_SERVER_URL
    }
  });
});

// Connect to SSE server
console.log(`Connecting to SSE server at ${SSE_SERVER_URL}...`);
let eventSource = new EventSource(SSE_SERVER_URL);

// Handle SSE connection open
eventSource.onopen = () => {
  console.log('Connected to SSE server');
};

// Handle SSE errors
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  
  // Try to reconnect after a delay
  setTimeout(() => {
    console.log('Attempting to reconnect to SSE server...');
    eventSource.close();
    eventSource = new EventSource(SSE_SERVER_URL);
  }, 5000);
};

// Handle SSE messages
eventSource.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    console.log('Received SSE message:', data);
  } catch (error) {
    console.error('Error parsing SSE message:', error);
  }
};

// Start the server
server.listen(INSPECTOR_PORT, () => {
  console.log(`MCP Inspector client running on port ${INSPECTOR_PORT}`);
  console.log(`Health check available at http://localhost:${INSPECTOR_PORT}/health`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down MCP Inspector client...');
  eventSource.close();
  server.close(() => {
    console.log('MCP Inspector client closed');
    process.exit(0);
  });
}); 