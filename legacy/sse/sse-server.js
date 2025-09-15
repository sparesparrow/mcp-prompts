#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SseServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const app = express();
const PORT = process.env.PORT || 3003;

// Configure CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Origin']
}));

// Create MCP server
const server = new McpServer(
  {
    name: "mcp-prompts-sse",
    version: "1.0.0"
  },
  {
    capabilities: {
      resources: { subscribe: false },
      tools: { listChanged: false },
      prompts: { listChanged: false }
    }
  }
);

// Define some tools
server.tool(
  'echo',
  {
    message: { type: 'string' }
  },
  async (params) => {
    return {
      type: 'object',
      object: { echo: params.message }
    };
  }
);

// Configure SSE endpoint
app.get('/events', (req, res) => {
  console.log('SSE connection request received');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  // Send a welcome message
  res.write(`data: ${JSON.stringify({ type: 'connect', message: 'Connected to MCP Prompts SSE stream' })}\n\n`);
  
  // Create the SSE transport
  const transport = new SseServerTransport(req, res);
  
  // Connect server to transport
  server.connect(transport).catch(error => {
    console.error('Error connecting server to transport:', error);
  });
  
  // Keep the connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);
  
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
    name: 'mcp-prompts-sse',
    version: '1.0.0',
    endpoints: [
      '/health',
      '/events'
    ]
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`SSE server running on port ${PORT}`);
  console.log(`SSE endpoint available at http://localhost:${PORT}/events`);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
}); 