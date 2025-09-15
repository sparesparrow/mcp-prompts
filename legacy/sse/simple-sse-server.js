#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import http from 'http';

const app = express();
const PORT = process.env.PORT || 3004;

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Origin']
}));

// SSE endpoint
app.get('/events', (req, res) => {
  console.log('SSE connection request received');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send a welcome message
  res.write(`data: ${JSON.stringify({ type: 'connect', message: 'Connected to SSE stream' })}\n\n`);
  
  // Keep the connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 10000);
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    console.log('SSE connection closed');
  });
});

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'simple-sse-server',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/events'
    ]
  });
});

// Start the server
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Simple SSE server running on port ${PORT}`);
  console.log(`SSE endpoint available at http://localhost:${PORT}/events`);
}); 