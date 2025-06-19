import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import cors from 'cors';
import { setupSSE } from './sse.js';
import { PromptService } from './prompt-service.js';
import { SequenceService } from './sequence-service.js';
import http from 'http';

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
): Promise<http.Server> {
  const app = express();

  // Enable JSON body parsing
  app.use(express.json());

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

  // CRUD endpoints for prompts
  app.post('/prompts', async (req, res, next) => {
    try {
      const { name, content, isTemplate, description, variables, tags, category } = req.body;
      if (!name || !content) {
        return res.status(400).json({ error: true, message: 'Name and content are required.' });
      }
      const prompt = await services.promptService.createPrompt({
        name,
        content,
        isTemplate: !!isTemplate,
        description,
        variables,
        tags,
        category,
      });
      res.status(201).json(prompt);
    } catch (err) {
      next(err);
    }
  });

  app.get('/prompts/:id', async (req, res, next) => {
    try {
      const prompt = await services.promptService.getPrompt(req.params.id);
      if (!prompt) {
        return res.status(404).json({ error: true, message: 'Prompt not found.' });
      }
      res.json(prompt);
    } catch (err) {
      next(err);
    }
  });

  app.put('/prompts/:id', async (req, res, next) => {
    try {
      const updated = await services.promptService.updatePrompt(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: true, message: 'Prompt not found.' });
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/prompts/:id', async (req, res, next) => {
    try {
      const deleted = await services.promptService.deletePrompt(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: true, message: 'Prompt not found.' });
      }
      res.status(204).end();
    } catch (err) {
      next(err);
    }
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

  // Add this after all other routes, before the error handler
  app.use((req, res) => {
    res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: 'Resource not found'
    });
  });

  // Global error handler middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  return await new Promise<http.Server>((resolve, reject) => {
    try {
      const httpServer = app.listen(config.port, config.host, () => {
        console.log(`HTTP server listening at http://${config.host}:${config.port}`);
        resolve(httpServer);
      });
      httpServer.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
} 