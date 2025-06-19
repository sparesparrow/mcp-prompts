import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import cors from 'cors';
import { setupSSE } from './sse.js';
import { PromptService } from './prompt-service.js';
import { SequenceService } from './sequence-service.js';

export interface HttpServerConfig {
  port: number;
  host: string;
  corsOrigin?: string;
  enableSSE?: boolean;
  ssePath?: string;
}

export interface ServerServices {
  promptService: PromptService;
  sequenceService: SequenceService;
}

export async function startHttpServer(
  server: Server | null = null,
  config: HttpServerConfig,
  services: ServerServices
): Promise<void> {
  const app = express();

  // Enable CORS
  app.use(cors({
    origin: config.corsOrigin || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Handle preflight requests
  app.options('*', (req, res) => {
    res.status(204).end();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/v1/sequence/:id', async (req, res, next) => {
    const { id } = req.params;
    try {
      const result = await services.sequenceService.getSequenceWithPrompts(id);
      res.json(result);
    } catch (error: any) {
      // Use next() to pass error to global error handler
      error.status = 404;
      error.code = 'NOT_FOUND';
      error.details = { id };
      next(error);
    }
  });

  // Set up SSE if enabled
  if (config.enableSSE) {
    setupSSE(app, config.ssePath || '/events');
  }

  // Global error handler middleware
  app.use((err, req, res, next) => {
    const status = err.status || 500;
    const code = err.code || 'INTERNAL_ERROR';
    const message = err.message || 'An unexpected error occurred.';
    const details = err.details || undefined;
    res.status(status).json({
      error: true,
      message,
      code,
      ...(details ? { details } : {})
    });
  });

  // Start the server
  await new Promise<void>((resolve, reject) => {
    try {
      const httpServer = app.listen(config.port, config.host, () => {
        console.log(`HTTP server listening at http://${config.host}:${config.port}`);
        resolve();
      });

      httpServer.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
} 