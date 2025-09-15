#!/usr/bin/env node

/**
 * Custom MCP Prompts Server with overridden configuration
 */
import { Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'node:http';

// Get dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration with defaults but prioritizing environment variables
const CONFIG = {
  name: "mcp-prompts",
  version: "1.2.38", // Set to the current package version
  storageType: process.env.STORAGE_TYPE || "file",
  promptsDir: process.env.PROMPTS_DIR || path.join(process.cwd(), "prompts"),
  backupsDir: process.env.BACKUPS_DIR || path.join(process.cwd(), "backups"),
  port: Number(process.env.PORT) || 3003,
  logLevel: (process.env.LOG_LEVEL || "info"),
  httpServer: process.env.HTTP_SERVER === "true",
  host: process.env.HOST || "0.0.0.0",
  enableSSE: process.env.ENABLE_SSE === "true",
  ssePath: process.env.SSE_PATH || "/events",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  postgres: process.env.POSTGRES_CONNECTION_STRING 
    ? {
        connectionString: process.env.POSTGRES_CONNECTION_STRING,
        host: "",
        port: 5432,
        database: "",
        user: "",
        password: "",
        ssl: false
      } 
    : {
        host: process.env.POSTGRES_HOST || "localhost",
        port: Number(process.env.POSTGRES_PORT) || 5432,
        database: process.env.POSTGRES_DATABASE || "mcp_prompts",
        user: process.env.POSTGRES_USER || "postgres",
        password: process.env.POSTGRES_PASSWORD || "postgres",
        ssl: process.env.POSTGRES_SSL === "true"
      }
};

// Log the configuration we're using
console.error(`Starting MCP Prompts Server v${CONFIG.version}`);
console.error("Config:", JSON.stringify(CONFIG, null, 2));

// Use memory adapter for now since your adapter factory is in the installed package
const memoryPrompts = {};

// Create a simple server
const server = new McpServer({
  name: CONFIG.name,
  version: CONFIG.version,
});

// Add simple list_prompts tool
server.tool(
  "list_prompts",
  {
    searchTerm: z.string().optional(),
    isTemplate: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    sort: z.enum(["name", "updatedAt"]).optional(),
    order: z.enum(["asc", "desc"]).optional(),
  },
  async (params) => {
    return {
      type: "object",
      object: {
        prompts: Object.values(memoryPrompts),
      },
    };
  }
);

// Add simple get_prompt tool
server.tool(
  "get_prompt",
  {
    id: z.string(),
  },
  async (params) => {
    const prompt = memoryPrompts[params.id];
    if (!prompt) {
      return {
        type: "error",
        error: `Prompt not found: ${params.id}`,
      };
    }
    return {
      type: "object",
      object: {
        prompt,
      },
    };
  }
);

// Add simple add_prompt tool
server.tool(
  "add_prompt",
  {
    name: z.string(),
    content: z.string(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    isTemplate: z.boolean().optional(),
    variables: z.array(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        required: z.boolean().optional(),
      })
    ).optional(),
  },
  async (params) => {
    const id = params.name.toLowerCase().replace(/\s+/g, "-");
    const prompt = {
      id,
      name: params.name,
      content: params.content,
      description: params.description || "",
      tags: params.tags || [],
      isTemplate: params.isTemplate || false,
      variables: params.variables || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    memoryPrompts[id] = prompt;
    
    return {
      type: "object",
      object: {
        id,
        prompt,
      },
    };
  }
);

// Start HTTP server if enabled
if (CONFIG.httpServer) {
  // Simple HTTP server implementation
  const httpServer = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', CONFIG.corsOrigin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Get the request path
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const path = url.pathname;
    
    console.error(`HTTP request: ${req.method} ${path}`);
    
    // SSE endpoint
    if (CONFIG.enableSSE && path === (CONFIG.ssePath || '/events')) {
      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      // Send a welcome message
      res.write(`data: ${JSON.stringify({ type: 'connect', message: 'Connected to MCP Prompts SSE stream' })}\n\n`);
      
      // Keep the connection alive with heartbeat
      const heartbeat = setInterval(() => {
        res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
      }, 30000);
      
      // Handle client disconnect
      req.on('close', () => {
        clearInterval(heartbeat);
        console.error('SSE connection closed');
      });
      
      return;
    }
    
    // Health check endpoint
    if (path === '/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        status: 'healthy',
        version: CONFIG.version,
        storageType: CONFIG.storageType,
        timestamp: new Date().toISOString(),
        features: {
          sse: Boolean(CONFIG.enableSSE),
          ssePath: CONFIG.enableSSE ? (CONFIG.ssePath || '/events') : null
        }
      }));
      return;
    }
    
    // Root endpoint with basic info
    if (path === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        name: CONFIG.name,
        version: CONFIG.version,
        storageType: CONFIG.storageType,
        endpoints: [
          '/health',
          ...(CONFIG.enableSSE ? [(CONFIG.ssePath || '/events')] : [])
        ]
      }));
      return;
    }
    
    // Not found
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  // Listen on the specified host and port
  httpServer.listen(CONFIG.port, CONFIG.host, () => {
    console.error(`HTTP server started on ${CONFIG.host}:${CONFIG.port}`);
    if (CONFIG.enableSSE) {
      console.error(`SSE endpoint available at ${CONFIG.ssePath || '/events'}`);
    }
  });
  
  // Handle server errors
  httpServer.on('error', (err) => {
    console.error('HTTP server error:', err);
  });
}

// Connect to transport
const transport = new StdioServerTransport();

async function main() {
  try {
    await server.connect(transport);
    console.error("MCP Prompts Server connected successfully to stdio transport");
  } catch (error) {
    console.error("Error starting server:", error);
  }
}

main(); 