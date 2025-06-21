import express from 'express';
import fs from 'fs';
import path from 'path';
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Request, Response, NextFunction } from 'express';

import type { PromptService } from './prompt-service.js';
import type { SequenceService } from './sequence-service.js';
import type { WorkflowService } from './workflow-service.js';
import { AppError, HttpErrorCode } from './errors.js';
import {
  auditLogWorkflowEvent,
  getWorkflowRateLimiter,
  HttpRunner,
  PromptRunner,
  releaseWorkflowSlot,
  ShellRunner,
} from './workflow-service.js';
import { promptSchemas } from './prompts.js';

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

function getWorkflowFileName(id: string, version: number) {
  return path.join(WORKFLOW_DIR, `${id}-v${version}.json`);
}

function saveWorkflowToFile(workflow: any) {
  ensureWorkflowDir();
  if (typeof workflow.id !== 'string' || typeof workflow.version !== 'number') {
    throw new Error('Workflow must have string id and number version');
  }
  fs.writeFileSync(
    getWorkflowFileName(workflow.id, workflow.version),
    JSON.stringify(workflow, null, 2),
  );
}

function loadWorkflowFromFile(id: string, version?: number) {
  ensureWorkflowDir();
  if (version !== undefined) {
    const file = getWorkflowFileName(id, version);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  // If no version specified, get the latest version
  const files = fs.readdirSync(WORKFLOW_DIR)
    .filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
  if (files.length === 0) return null;
  // Find the highest version
  const versions = files.map(f => {
    const match = f.match(/-v(\d+)\.json$/);
    return match ? parseInt(match[1], 10) : 0;
  });
  const maxVersion = Math.max(...versions);
  const file = getWorkflowFileName(id, maxVersion);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function getAllWorkflowVersions(id: string) {
  ensureWorkflowDir();
  const files = fs.readdirSync(WORKFLOW_DIR)
    .filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
  return files
    .map(f => {
      const match = f.match(/-v(\d+)\.json$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter(v => v !== null)
    .sort((a, b) => (a as number) - (b as number));
}

function getAllWorkflows(latestOnly = true) {
  ensureWorkflowDir();
  const files = fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.json'));
  const workflowsById: Record<string, any[]> = {};
  files.forEach(f => {
    const match = f.match(/^(.*)-v(\d+)\.json$/);
    if (!match) return;
    const id = match[1];
    const version = parseInt(match[2], 10);
    if (!workflowsById[id]) workflowsById[id] = [];
    workflowsById[id].push({ version, file: f });
  });
  const result: any[] = [];
  Object.entries(workflowsById).forEach(([id, versions]) => {
    const sorted = (versions as any[]).sort((a, b) => b.version - a.version);
    if (latestOnly) {
      const file = sorted[0].file;
      result.push(JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, file), 'utf8')));
    } else {
      sorted.forEach(({ file }) => {
        result.push(JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, file), 'utf8')));
      });
    }
  });
  return result;
}

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'MCP-Prompts API',
    version: '1.0.0',
    description: 'API documentation for MCP-Prompts server',
  },
  servers: [{ url: 'http://localhost:3003', description: 'Local server' }],
  components: {
    schemas: {
      Prompt: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          content: { type: 'string' },
          isTemplate: { type: 'boolean' },
          description: { type: 'string' },
          variables: { type: 'object', additionalProperties: true },
          tags: { type: 'array', items: { type: 'string' } },
          category: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          version: { type: 'integer' },
        },
      },
    },
  },
};

const swaggerOptions = {
  swaggerDefinition,
  apis: ['src/http-server.ts'], // Use static path to avoid __filename ReferenceError
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 * API key authentication middleware
 * Reads valid API keys from process.env.API_KEYS (comma-separated)
 * Skips /health and /api-docs endpoints
 */
function apiKeyAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const openPaths = ['/health', '/api-docs'];
  if (openPaths.some(path => req.path.startsWith(path))) {
    return next();
  }
  const apiKeys = (process.env.API_KEYS || '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);
  const key = req.header('x-api-key');
  if (!key || !apiKeys.includes(key)) {
    return res.status(401).json({ error: 'Unauthorized: missing or invalid API key' });
  }
  next();
}

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
      noSniff: true,
      referrerPolicy: { policy: 'same-origin' },
    }),
  );

  // Add rate limiting
  if (process.env.ENABLE_RATE_LIMIT !== 'false') {
    const limiter = rateLimit({
      legacyHeaders: false,
      // 15 minutes
      max: config.rateLimit?.max || 100,
      // Limit each IP to 100 requests per windowMs
      standardHeaders: true,

      windowMs: config.rateLimit?.windowMs || 15 * 60 * 1000,
    });
    app.use(limiter);
  }

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
  app.get('/health', async (req, res) => {
    try {
      const storage = services.promptService.getStorage();
      const healthy = await storage.healthCheck?.();
      let poolMetrics = undefined;
      // Expose pool metrics if PostgresAdapter
      if (typeof storage.getPoolMetrics === 'function') {
        poolMetrics = storage.getPoolMetrics();
      }
      if (!healthy) {
        res.status(503).json({
          status: 'error',
          storage: 'unhealthy',
          pool: poolMetrics,
        });
        return;
      }
      res.json({
        status: 'ok',
        version: process.env.npm_package_version || 'dev',
        storage: 'healthy',
        pool: poolMetrics,
      });
    } catch (err) {
      res.status(503).json({
        status: 'error',
        storage: 'unhealthy',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  // Add API key authentication middleware
  app.use(apiKeyAuth);

  /**
   * @openapi
   * /prompts:
   *   get:
   *     summary: List prompts with pagination, sorting, and filtering
   *     parameters:
   *       - in: query
   *         name: offset
   *         schema:
   *           type: integer
   *           minimum: 0
   *         description: Number of items to skip
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *         description: Maximum number of items to return
   *       - in: query
   *         name: sort
   *         schema:
   *           type: string
   *           enum: [createdAt, updatedAt, name]
   *         description: Field to sort by
   *       - in: query
   *         name: order
   *         schema:
   *           type: string
   *           enum: [asc, desc]
   *         description: Sort order
   *       - in: query
   *         name: category
   *         schema:
   *           type: string
   *         description: Filter by category
   *       - in: query
   *         name: tags
   *         schema:
   *           type: string
   *         description: Comma-separated list of tags (all must match)
   *       - in: query
   *         name: isTemplate
   *         schema:
   *           type: boolean
   *         description: Filter for template/non-template prompts
   *       - in: query
   *         name: search
   *         schema:
   *           type: string
   *         description: Search term for name, description, or content
   *     responses:
   *       200:
   *         description: Paginated list of prompts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 prompts:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Prompt'
   *                 total:
   *                   type: integer
   *                 offset:
   *                   type: integer
   *                 limit:
   *                   type: integer
   */
  app.get(
    '/prompts',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        // Parse and validate query params
        const querySchema = z.object({
          offset: z.string().optional().transform(v => (v ? parseInt(v, 10) : 0)),
          limit: z.string().optional().transform(v => (v ? parseInt(v, 10) : 20)),
          sort: z.enum(['createdAt', 'updatedAt', 'name']).optional(),
          order: z.enum(['asc', 'desc']).optional(),
          category: z.string().optional(),
          tags: z.string().optional(),
          isTemplate: z.string().optional().transform(v => (v === 'true' ? true : v === 'false' ? false : undefined)),
          search: z.string().optional(),
        });
        const parseResult = querySchema.safeParse(req.query);
        if (!parseResult.success) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid query parameters',
              details: parseResult.error.errors,
            },
          });
          return;
        }
        const { offset, limit, sort, order, category, tags, isTemplate, search } = parseResult.data;
        const options: any = { offset, limit, sort, order, category, isTemplate, search };
        if (tags) {
          options.tags = tags.split(',').map((t: string) => t.trim()).filter(Boolean);
        }
        const prompts = await services.promptService.listPrompts(options);
        // For total count, fetch without pagination
        const total = (await services.promptService.listPrompts({ ...options, offset: 0, limit: undefined })).length;
        res.json({ prompts, total, offset, limit });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /prompts
   * Create a new prompt version. If version is not specified, auto-increment.
   */
  app.post(
    '/prompts',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const parseResult = promptSchemas.create.safeParse(req.body);
        if (!parseResult.success) {
          // Forward validation error to the global handler
          return next(new z.ZodError(parseResult.error.errors));
        }
        const prompt = parseResult.data;
        const created = await services.promptService.createPrompt(prompt);
        return res.status(201).json({ success: true, prompt: created });
      } catch (err) {
        return next(err);
      }
    },
  );

  /**
   * GET /prompts/:id
   * Get a prompt by id and optional version.
   */
  app.get(
    '/prompts/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const id = req.params.id;
        const version = req.query.version ? Number(req.query.version) : undefined;
        const prompt = await services.promptService.getPrompt(id, version);
        if (!prompt) {
          return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Prompt not found' } });
        }
        return res.status(200).json({ success: true, prompt });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * @openapi
   * /prompts/{id}/{version}:
   *   put:
   *     summary: Update an existing prompt
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: version
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/Prompt'
   *     responses:
   *       200:
   *         description: The updated prompt
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Prompt'
   */
  app.put('/prompts/:id/:version', async (req, res, next) => {
    try {
      const prompt = await services.promptService.updatePrompt(
        req.params.id,
        parseInt(req.params.version, 10),
        req.body,
      );
      res.json({ prompt });
    } catch (error: any) {
      next(error);
    }
  });

  /**
   * @openapi
   * /prompts/{id}/{version}:
   *   delete:
   *     summary: Delete a prompt
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *       - in: path
   *         name: version
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       204:
   *         description: Prompt deleted successfully
   */
  app.delete('/prompts/:id/:version', async (req, res, next) => {
    try {
      await services.promptService.deletePrompt(req.params.id, parseInt(req.params.version, 10));
      res.status(204).send();
    } catch (error: any) {
      next(error);
    }
  });

  /**
   * GET /prompts/:id/versions
   * List all versions for a prompt ID
   */
  app.get(
    '/prompts/:id/versions',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const versions = await services.promptService.listPromptVersions(req.params.id);
        res.json({ success: true, id: req.params.id, versions });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * @openapi
   * /prompts/bulk:
   *   post:
   *     summary: Bulk create prompts
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: array
   *             items:
   *               $ref: '#/components/schemas/Prompt'
   *     responses:
   *       200:
   *         description: Array of results for each prompt
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   success:
   *                     type: boolean
   *                   id:
   *                     type: string
   *                   error:
   *                     type: string
   */
  app.post(
    '/prompts/bulk',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const parseResult = promptSchemas.bulkCreate.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid bulk prompt data',
            details: parseResult.error.errors,
          },
        });
        return;
      }
      const results = await services.promptService.createPromptsBulk(parseResult.data);
      res.status(200).json(results);
    },
  );

  /**
   * @openapi
   * /prompts/bulk:
   *   delete:
   *     summary: Bulk delete prompts
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               ids:
   *                 type: array
   *                 items:
   *                   type: string
   *     responses:
   *       200:
   *         description: Array of results for each ID
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   success:
   *                     type: boolean
   *                   id:
   *                     type: string
   *                   error:
   *                     type: string
   */
  app.delete(
    '/prompts/bulk',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const parseResult = promptSchemas.bulkDelete.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid bulk delete data',
            details: parseResult.error.errors,
          },
        });
        return;
      }
      const results = await services.promptService.deletePromptsBulk(parseResult.data.ids);
      res.status(200).json(results);
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
   * Create a new workflow version. If version is not specified, auto-increment.
   * Request body: { ...workflow }
   * Response: { success, id, version, message }
   */
  app.post(
    '/api/v1/workflows',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const workflow = req.body;
        if (!services.workflowService.validateWorkflow(workflow)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid workflow definition.',
            },
          });
          return;
        }
        if (!workflow.id || typeof workflow.id !== 'string') {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Workflow must have a string id.',
            },
          });
          return;
        }
        // Determine version
        let version = workflow.version;
        if (typeof version !== 'number') {
          // Auto-increment version
          const versions = getAllWorkflowVersions(workflow.id);
          version = versions.length > 0 ? Math.max(...versions) + 1 : 1;
          workflow.version = version;
        }
        // Check if this version already exists
        if (loadWorkflowFromFile(workflow.id, version)) {
          res.status(409).json({
            success: false,
            error: {
              code: 'CONFLICT',
              message: `Workflow version ${version} already exists for id ${workflow.id}`,
            },
          });
          return;
        }
        saveWorkflowToFile(workflow);
        res.status(201).json({
          id: workflow.id,
          version,
          message: 'Workflow version saved.',
          success: true,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/v1/workflows/:id
   * Retrieve the latest version of a workflow by ID
   * Response: { ...workflow } or 404
   */
  app.get(
    '/api/v1/workflows/:id',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const workflow = loadWorkflowFromFile(req.params.id);
        if (!workflow) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Workflow not found.',
            },
          });
          return;
        }
        res.json(workflow);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/v1/workflows/:id/versions
   * List all versions for a workflow ID
   * Response: [ { version, createdAt } ]
   */
  app.get(
    '/api/v1/workflows/:id/versions',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const versions = getAllWorkflowVersions(req.params.id);
        if (!versions.length) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'No versions found for workflow.',
            },
          });
          return;
        }
        // Optionally, include createdAt for each version
        const result = versions.map(v => {
          const wf = loadWorkflowFromFile(req.params.id, v);
          return { version: v, createdAt: wf?.createdAt };
        });
        res.json(result);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/v1/workflows/:id/versions/:version
   * Retrieve a specific version of a workflow
   * Response: { ...workflow } or 404
   */
  app.get(
    '/api/v1/workflows/:id/versions/:version',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const version = parseInt(req.params.version, 10);
        if (isNaN(version)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Version must be a number.',
            },
          });
          return;
        }
        const workflow = loadWorkflowFromFile(req.params.id, version);
        if (!workflow) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Workflow version not found.',
            },
          });
          return;
        }
        res.json(workflow);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * DELETE /api/v1/workflows/:id/versions/:version
   * Delete a specific version of a workflow
   * Response: { success, id, version, message }
   */
  app.delete(
    '/api/v1/workflows/:id/versions/:version',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const version = parseInt(req.params.version, 10);
        if (isNaN(version)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Version must be a number.',
            },
          });
          return;
        }
        const file = getWorkflowFileName(req.params.id, version);
        if (!fs.existsSync(file)) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Workflow version not found.',
            },
          });
          return;
        }
        fs.unlinkSync(file);
        res.json({
          success: true,
          id: req.params.id,
          version,
          message: 'Workflow version deleted.',
        });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * GET /api/v1/workflows
   * List all workflows (latest version only)
   * Response: [ { ...workflow }, ... ]
   */
  app.get(
    '/api/v1/workflows',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try {
        const workflows = getAllWorkflows(true); // latestOnly = true
        res.json(workflows);
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * POST /api/v1/workflows/:id/run
   * Optionally accepts ?version= in query to run a specific version
   * Response: { success, message, outputs } or 404
   */
  app.post(
    '/api/v1/workflows/:id/run',
    async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const userId = (req.headers['x-user-id'] as string) || 'anonymous';
      const workflowId = req.params.id;
      const versionParam = req.query.version;
      let version: number | undefined = undefined;
      if (versionParam !== undefined) {
        version = parseInt(versionParam as string, 10);
        if (isNaN(version)) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Version must be a number.',
            },
          });
          return;
        }
      }
      if (!checkWorkflowRateLimit(userId)) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT',
            message: 'Too many concurrent workflows. Please wait and try again.',
          },
        });
        return;
      }
      let result;
      try {
        const workflow = loadWorkflowFromFile(workflowId, version);
        if (!workflow) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Workflow not found.',
            },
          });
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
   * @openapi
   * /api/v1/workflows/{executionId}/resume:
   *   post:
   *     summary: Resume a paused workflow at a human-approval step
   *     parameters:
   *       - in: path
   *         name: executionId
   *         required: true
   *         schema:
   *           type: string
   *         description: The workflow execution ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               input:
   *                 description: Input provided by the human
   *                 type: any
   *     responses:
   *       200:
   *         description: Workflow resumed and result returned
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 outputs:
   *                   type: object
   *                 paused:
   *                   type: boolean
   *                 prompt:
   *                   type: string
   *                 stepId:
   *                   type: string
   *                 executionId:
   *                   type: string
   */
  app.post(
    '/api/v1/workflows/:executionId/resume',
    async (req, res, next) => {
      const { executionId } = req.params;
      const { input } = req.body;
      try {
        const result = await services.workflowService.resumeWorkflow(executionId, input);
        res.status(200).json(result);
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

  // Global 404 handler middleware
  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: HttpErrorCode.NOT_FOUND,
        message: 'Resource not found',
      },
    });
  });

  // Global error handler middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err instanceof AppError) {
      const response: { code: string; message: string; details?: any } = {
        code: err.code,
        message: err.message,
      };
      if ((err as any).details) {
        response.details = (err as any).details;
      }
      return res.status(err.statusCode).json({
        success: false,
        error: response,
      });
    }

    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: HttpErrorCode.VALIDATION_ERROR,
          message: 'Invalid input data.',
          details: err.issues,
        },
      });
    }

    // Log unexpected errors for debugging
    // In production, use a structured logger like Pino or Winston
    console.error('UNHANDLED_ERROR:', err);

    res.status(500).json({
      success: false,
      error: {
        code: HttpErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected internal server error occurred.',
      },
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
