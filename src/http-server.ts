import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { PromptService } from './prompt-service.js';
import { SequenceService } from './sequence-service.js';
import http from 'http';

export interface HttpServerConfig {
  port: number;
  host: string;
  corsOrigin?: string;
  enableSSE?: boolean;
  ssePath?: string;
  rateLimit?: {
    windowMs: number;
    max: number;
  };
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

  // Add security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: "same-site" },
    dnsPrefetchControl: true,
    frameguard: true,
    hidePoweredBy: true,
    hsts: true,
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: true,
    referrerPolicy: { policy: "same-origin" },
    xssFilter: true,
  }));

  // Add rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit?.windowMs || 15 * 60 * 1000, // 15 minutes
    max: config.rateLimit?.max || 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use(limiter);

  // Enable JSON body parsing with size limits
  app.use(express.json({ limit: '1mb' }));

  // Enable CORS with proper options
  app.use(cors({
    origin: config.corsOrigin || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
    credentials: true,
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
  app.post('/prompts', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { name, content, isTemplate, description, variables, tags, category } = req.body;
      if (!name || !content) {
        res.status(400).json({ error: true, message: 'Name and content are required.' });
        return;
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

  app.get('/prompts/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const prompt = await services.promptService.getPrompt(req.params.id);
      if (!prompt) {
        res.status(404).json({ error: true, message: 'Prompt not found.' });
        return;
      }
      res.json(prompt);
    } catch (err) {
      next(err);
    }
  });

  app.put('/prompts/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const updated = await services.promptService.updatePrompt(req.params.id, req.body);
      if (!updated) {
        res.status(404).json({ error: true, message: 'Prompt not found.' });
        return;
      }
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  app.delete('/prompts/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      await services.promptService.deletePrompt(req.params.id);
      res.status(204).end();
    } catch (err) {
      res.status(404).json({ error: true, message: 'Prompt not found.' });
    }
  });

  app.get('/api/v1/sequence/:id', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

  // Add after other endpoints, before the 404 handler
  app.post('/diagram', async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const { promptIds } = req.body;
      if (!Array.isArray(promptIds) || promptIds.length === 0) {
        res.status(400).json({ error: true, message: 'promptIds must be a non-empty array.' });
        return;
      }
      // Fetch prompt names for diagram nodes
      const prompts = await Promise.all(promptIds.map((id: string) => services.promptService.getPrompt(id)));
      const nodes = prompts.map((p, i) => `P${i}[${p ? p.name : promptIds[i]}]`);
      // Simple linear flow: P0 --> P1 --> P2 ...
      let edges = '';
      for (let i = 0; i < nodes.length - 1; i++) {
        edges += `${nodes[i]} --> ${nodes[i + 1]}\n`;
      }
      const mermaid = `graph TD\n${nodes.join('\n')}\n${edges}`;
      res.json({ mermaid });
    } catch (err: any) {
      res.status(500).json({ error: true, message: err instanceof Error ? err.message : String(err) });
    }
  });

  // Set up SSE if enabled
  if (config.enableSSE) {
    // setupSSE(app, config.ssePath || '/events');
  }

  // Add this after all other routes, before the error handler
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      message: 'Resource not found'
    });
  });

  // Global error handler middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = typeof err.status === 'number' ? err.status : 500;
    const code = typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';
    const details = err.details || undefined;
    res.status(status).json({
      error: true,
      code,
      message: err instanceof Error ? err.message : String(err),
      details,
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