#!/usr/bin/env node

/**
 * MCP Inspector SSE Patch
 * 
 * This script patches the MCP Prompts server to enable SSE functionality.
 * It injects the necessary configuration into the server at runtime.
 */

import { createServer } from 'http';
import { parse } from 'url';
import express from 'express';
import cors from 'cors';

// Create an Express app for the SSE server
const app = express();

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Connected clients
const clients = new Set();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: {
      sse: true,
      ssePath: '/events'
    }
  });
});

// SSE endpoint
app.get('/events', (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Send initial connection message
  const connectMessage = JSON.stringify({
    type: 'connect',
    message: 'Connected to SSE stream'
  });
  res.write(`data: ${connectMessage}\n\n`);

  // Add client to the set
  clients.add(res);

  // Handle client disconnect
  req.on('close', () => {
    clients.delete(res);
    console.log('Client disconnected');
  });

  // Log connection
  console.log('Client connected to SSE');
});

// Function to send a message to all connected clients
function sendToAll(data) {
  const message = typeof data === 'string' ? data : JSON.stringify(data);
  clients.forEach(client => {
    client.write(`data: ${message}\n\n`);
  });
}

// Heartbeat interval
const heartbeatInterval = setInterval(() => {
  if (clients.size > 0) {
    sendToAll({
      type: 'heartbeat',
      timestamp: new Date().toISOString()
    });
  }
}, 10000); // Send heartbeat every 10 seconds

// Create HTTP server
const PORT = process.env.PORT || 3004;
const server = createServer(app);

// Start the server
server.listen(PORT, () => {
  console.log(`SSE server running on port ${PORT}`);
  console.log(`SSE endpoint available at http://localhost:${PORT}/events`);
  console.log(`Health check available at http://localhost:${PORT}/health`);
});

// Handle process termination
process.on('SIGINT', () => {
  clearInterval(heartbeatInterval);
  console.log('Shutting down SSE server...');
  server.close(() => {
    console.log('SSE server closed');
    process.exit(0);
  });
}); 