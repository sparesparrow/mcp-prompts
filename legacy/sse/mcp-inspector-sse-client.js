#!/usr/bin/env node

/**
 * MCP Inspector SSE Client
 * 
 * This script connects to the SSE server and forwards events to the MCP Inspector.
 * It acts as a bridge between the SSE server and the MCP Inspector.
 */

import * as eventsource from 'eventsource';
const EventSource = eventsource.default || eventsource;
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import * as WebSocketModule from 'ws';
const WebSocket = WebSocketModule.default || WebSocketModule;

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

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Connected WebSocket clients
const wsClients = new Set();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      sse: true,
      ssePath: SSE_SERVER_URL,
      websocket: true
    }
  });
});

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  wsClients.add(ws);

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connect',
    message: 'Connected to MCP Inspector'
  }));

  // Handle client disconnect
  ws.on('close', () => {
    wsClients.delete(ws);
    console.log('WebSocket client disconnected');
  });

  // Handle messages from client
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received message from client:', data);
      
      // Handle client messages if needed
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  });
});

// Function to send a message to all WebSocket clients
function sendToAllWs(data) {
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Connect to SSE server
console.log(`Connecting to SSE server at ${SSE_SERVER_URL}...`);
let eventSource = new EventSource(SSE_SERVER_URL);

// Handle SSE connection open
eventSource.onopen = () => {
  console.log('Connected to SSE server');
  sendToAllWs({
    type: 'sse-connected',
    message: 'Connected to SSE server'
  });
};

// Handle SSE errors
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  sendToAllWs({
    type: 'sse-error',
    message: 'Error connecting to SSE server'
  });
  
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
    
    // Forward the message to all WebSocket clients
    sendToAllWs(data);
  } catch (error) {
    console.error('Error parsing SSE message:', error);
  }
};

// Start the server
server.listen(INSPECTOR_PORT, () => {
  console.log(`MCP Inspector bridge running on port ${INSPECTOR_PORT}`);
  console.log(`WebSocket endpoint available at ws://localhost:${INSPECTOR_PORT}`);
  console.log(`Health check available at http://localhost:${INSPECTOR_PORT}/health`);
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('Shutting down MCP Inspector bridge...');
  eventSource.close();
  server.close(() => {
    console.log('MCP Inspector bridge closed');
    process.exit(0);
  });
}); 