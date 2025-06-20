import fs from 'fs';
import path from 'path';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type http from 'http';
import swaggerUi from 'swagger-ui-express';
import swaggerJSDoc from 'swagger-jsdoc';

import type { PromptService } from './prompt-service.js';
import type { SequenceService } from './sequence-service.js';
import type { WorkflowService } from './workflow-service.js';
import {
  auditLogWorkflowEvent,
  getWorkflowRateLimiter,
  HttpRunner,
  PromptRunner,
  releaseWorkflowSlot,
  ShellRunner,
} from './workflow-service.js';

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
  workflowService: WorkflowService;
}

const WORKFLOW_DIR = path.resolve(process.cwd(), 'data', 'workflows');
function ensureWorkflowDir() {
  if (!fs.existsSync(WORKFLOW_DIR)) fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
}
function saveWorkflowToFile(workflow: any) {
  ensureWorkflowDir();
  fs.writeFileSync(
    path.join(WORKFLOW_DIR, `${workflow.id}.json`),
    JSON.stringify(workflow, null, 2),
  );
}
function loadWorkflowFromFile(id: string) {
  const file = path.join(WORKFLOW_DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function getAllWorkflows() {
  ensureWorkflowDir();
  return fs.readdirSync(WORKFLOW_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, f), 'utf8')));
}

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'MCP-Prompts API',
    version: '1.0.0',
    description: 'API documentation for MCP-Prompts server',
  },
  servers: [
    { url: 'http://localhost:3003', description: 'Local server' },
  ],
  components: {
    schemas: {
      Prompt: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
          content: {
            type: 'string',
          },
          isTemplate: {
            type: 'boolean',
          },
          description: {
            type: 'string',
          },
          variables: {
            type: 'object',
            additionalProperties: true,
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          category: {
            type: 'string',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
          version: {
            type: 'integer',
          },
        },
      },
    },
  },
};

const swaggerOptions = {
  swaggerDefinition,
  apis: [__filename], // Inline JSDoc below
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 *
 * @param server
 * @param config
 * @param services
 */
export async function startHttpServer(
  server: Server | null = null,
  config: HttpServerConfig,
  services: ServerServices,
): Promise<http.Server> {
  const app = express();

  // Add security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: true,
      crossOriginResourcePolicy: { policy: 'same-site' },
      dnsPrefetchControl: true,
      frameguard: true,
      hidePoweredBy: true,
      hsts: true,
      ieNoOpen: true,
      noSniff: true,
      permittedCrossDomainPolicies: true,
      referrerPolicy: { policy: 'same-origin' },
      xssFilter: true,
    }),
  );

  // Add rate limiting
  const limiter = rateLimit({
    legacyHeaders: false,
    // 15 minutes
    max: config.rateLimit?.max || 100,
    // Limit each IP to 100 requests per windowMs
    standardHeaders: true,

    windowMs: config.rateLimit?.windowMs || 15 * 60 * 1000,
  });
  app.use(limiter);

  // Enable JSON body parsing with size limits
  app.use(express.json({ limit: '1mb' }));

  // Enable CORS with proper options
  app.use(
    cors({
      allowedHeaders: ['Content-Type', 'Authorization'],
      // 24 hours
      credentials: true,

      maxAge: 86400,

      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      origin: config.corsOrigin || '*',
    }),
  );

  // Handle preflight requests
  app.options('*', (req, res) => {
    res.status(204).end();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // CRUD endpoints for prompts
  /**
   * @openapi
   * /prompts:
   *   post:
   *     summary: Create a new prompt
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Prompt'
   *     responses:
   *       201:
   *         description: Prompt created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Prompt'
   */
  app.post(
    '/prompts',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const { name, content, isTemplate, description, variables, tags, category } = req.body;
        if (!name || !content) {
          res.status(400).json({ error: true, message: 'Name and content are required.' });
          return;
        }
        const prompt = await services.promptService.createPrompt({
          category,
          content,
          description,
          isTemplate: !!isTemplate,
          name,
          tags,
          variables,
        });
        res.status(201).json(prompt);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * @openapi
   * /prompts/{id}:
   *   get:
   *     summary: Get a prompt by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Prompt object
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Prompt'
   *       404:
   *         description: Prompt not found
   */
  app.get(
    '/prompts/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    },
  );

  /**
   * @openapi
   * /prompts/{id}:
   *   put:
   *     summary: Update a prompt by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Prompt'
   *     responses:
   *       200:
   *         description: Updated prompt
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Prompt'
   *       404:
   *         description: Prompt not found
   */
  app.put(
    '/prompts/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    },
  );

  /**
   * @openapi
   * /prompts/{id}:
   *   delete:
   *     summary: Delete a prompt by ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Prompt deleted
   *       404:
   *         description: Prompt not found
   */
  app.delete(
    '/prompts/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        await services.promptService.deletePrompt(req.params.id);
        res.status(204).end();
      } catch (err) {
        res.status(404).json({ error: true, message: 'Prompt not found.' });
      }
    },
  );

  app.get(
    '/api/v1/sequence/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    },
  );

  // Add after other endpoints, before the 404 handler
  app.post(
    '/diagram',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const { promptIds } = req.body;
        if (!Array.isArray(promptIds) || promptIds.length === 0) {
          res.status(400).json({ error: true, message: 'promptIds must be a non-empty array.' });
          return;
        }
        // Fetch prompt names for diagram nodes
        const prompts = await Promise.all(
          promptIds.map((id: string) => services.promptService.getPrompt(id)),
        );
        const nodes = prompts.map((p, i) => `P${i}[${p ? p.name : promptIds[i]}]`);
        // Simple linear flow: P0 --> P1 --> P2 ...
        let edges = '';
        for (let i = 0; i < nodes.length - 1; i++) {
          edges += `${nodes[i]} --> ${nodes[i + 1]}\n`;
        }
        const mermaid = `graph TD\n${nodes.join('\n')}\n${edges}`;
        res.json({ mermaid });
      } catch (err: any) {
        res
          .status(500)
          .json({ error: true, message: err instanceof Error ? err.message : String(err) });
      }
    },
  );

  const checkWorkflowRateLimit = getWorkflowRateLimiter();

  /**
   * POST /api/v1/workflows
   * Save a workflow definition by ID
   * Request body: { ...workflow }
   * Response: { success, id, message }
   */
  app.post(
    '/api/v1/workflows',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const workflow = req.body;
        if (!services.workflowService.validateWorkflow(workflow)) {
          res.status(400).json({ error: true, message: 'Invalid workflow definition.' });
          return;
        }
        if (!workflow.id || typeof workflow.id !== 'string') {
          res.status(400).json({ error: true, message: 'Workflow must have a string id.' });
          return;
        }
        saveWorkflowToFile(workflow);
        res.status(201).json({ id: workflow.id, message: 'Workflow saved.', success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/v1/workflows/:id
   * Retrieve a workflow definition by ID
   * Response: { ...workflow } or 404
   */
  app.get(
    '/api/v1/workflows/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const workflow = loadWorkflowFromFile(req.params.id);
        if (!workflow) {
          res.status(404).json({ error: true, message: 'Workflow not found.' });
          return;
        }
        res.json(workflow);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/v1/workflows/:id/run
   * Run a saved workflow by ID
   * Response: { success, message, outputs } or 404
   */
  app.post(
    '/api/v1/workflows/:id/run',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const userId = (req.headers['x-user-id'] as string) || 'anonymous';
      const workflowId = req.params.id;
      if (!checkWorkflowRateLimit(userId)) {
        res.status(429).json({
          error: true,
          message: 'Too many concurrent workflows. Please wait and try again.',
        });
        return;
      }
      let result;
      try {
        const workflow = loadWorkflowFromFile(workflowId);
        if (!workflow) {
          res.status(404).json({ error: true, message: 'Workflow not found.' });
          return;
        }
        // Audit: workflow start
        auditLogWorkflowEvent({ details: { workflow }, eventType: 'start', userId, workflowId });
        // Prepare step runners
        const promptRunner = new PromptRunner(services.promptService);
        const shellRunner = new ShellRunner();
        const httpRunner = new HttpRunner();
        const stepRunners = {
          http: httpRunner,
          prompt: promptRunner,
          shell: shellRunner,
        };
        // Run the workflow
        result = await (services.workflowService as any).runWorkflowSteps(workflow, stepRunners);
        // Audit: workflow end
        auditLogWorkflowEvent({ details: { result }, eventType: 'end', userId, workflowId });
        res.status(result.success ? 200 : 400).json(result);
      } catch (err) {
        // Audit: workflow error
        auditLogWorkflowEvent({
          details: { error: err instanceof Error ? err.message : String(err) },
          eventType: 'error',
          userId,
          workflowId,
        });
        next(err);
      } finally {
        releaseWorkflowSlot(userId);
      }
    },
  );

  /**
   * GET /api/v1/workflows
   * List all workflows
   * Response: [ { ...workflow }, ... ]
   */
  app.get(
    '/api/v1/workflows',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const workflows = getAllWorkflows();
        res.json(workflows);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /api/v1/workflows/:id
   * Delete a workflow by ID
   * Response: { success, id, message }
   */
  app.delete(
    '/api/v1/workflows/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const file = path.join(WORKFLOW_DIR, `${req.params.id}.json`);
        if (!fs.existsSync(file)) {
          res.status(404).json({ error: true, message: 'Workflow not found.' });
          return;
        }
        fs.unlinkSync(file);
        res.json({ id: req.params.id, message: 'Workflow deleted.', success: true });
      } catch (err) {
        next(err);
      }
    },
  );

  // Set up SSE if enabled
  if (config.enableSSE) {
    // setupSSE(app, config.ssePath || '/events');
  }

  // Add this after all other routes, before the error handler
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Global error handler middleware
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({
      code: 'NOT_FOUND',
      error: true,
      message: 'Resource not found',
    });
  });

  // Global error handler middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const status = typeof err.status === 'number' ? err.status : 500;
    const code = typeof err.code === 'string' ? err.code : 'INTERNAL_ERROR';
    const details = err.details || undefined;
    res.status(status).json({
      code,
      details,
      error: true,
      message: err instanceof Error ? err.message : String(err),
    });
  });

  // Start the server
  return await new Promise<http.Server>((resolve, reject) => {
    try {
      const httpServer = app.listen(config.port, config.host, () => {
        console.log(`HTTP server listening at http://${config.host}:${config.port}`);
        resolve(httpServer);
      });
      httpServer.on('error', error => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
}
