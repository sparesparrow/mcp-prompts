import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import cors from 'cors';
import type { NextFunction, Request, Response } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import helmet from 'helmet';
import type http from 'http';
import path from 'path';
import swaggerJSDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';

import { AppError, HttpErrorCode } from './errors.js';
import type { StorageAdapter } from './interfaces.js';
import type { PromptService } from './prompt-service.js';
import { promptSchemas } from './prompts.js';
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

const catchAsync = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

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
  storageAdapters: StorageAdapter[];
}

const WORKFLOW_DIR = path.resolve(process.cwd(), 'data', 'workflows');
/**
 *
 */
function ensureWorkflowDir() {
  if (!fs.existsSync(WORKFLOW_DIR)) fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
}

/**
 *
 * @param id
 * @param version
 */
function getWorkflowFileName(id: string, version: number) {
  return path.join(WORKFLOW_DIR, `${id}-v${version}.json`);
}

/**
 *
 * @param workflow
 */
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

/**
 *
 * @param id
 * @param version
 */
function loadWorkflowFromFile(id: string, version?: number) {
  ensureWorkflowDir();
  if (version !== undefined) {
    const file = getWorkflowFileName(id, version);
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  // If no version specified, get the latest version
  const files = fs
    .readdirSync(WORKFLOW_DIR)
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

/**
 *
 * @param id
 */
function getAllWorkflowVersions(id: string) {
  ensureWorkflowDir();
  const files = fs
    .readdirSync(WORKFLOW_DIR)
    .filter(f => f.startsWith(`${id}-v`) && f.endsWith('.json'));
  return files
    .map(f => {
      const match = f.match(/-v(\d+)\.json$/);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter(v => v !== null)
    .sort((a, b) => (a as number) - (b as number));
}

/**
 *
 * @param latestOnly
 */
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
    workflowsById[id].push({ file: f, version });
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
  components: {
    schemas: {
      Prompt: {
        properties: {
          content: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          id: { type: 'string' },
          createdAt: { format: 'date-time', type: 'string' },
          isTemplate: { type: 'boolean' },
          name: { type: 'string' },
          tags: { items: { type: 'string' }, type: 'array' },
          updatedAt: { format: 'date-time', type: 'string' },
          variables: { additionalProperties: true, type: 'object' },
          version: { type: 'integer' },
        },
        type: 'object',
      },
    },
  },
  info: {
    description: 'API documentation for MCP-Prompts server',
    title: 'MCP-Prompts API',
    version: '1.0.0',
  },
  openapi: '3.0.0',
  servers: [{ description: 'Local server', url: 'http://localhost:3003' }],
};

const swaggerOptions = {
  apis: ['src/http-server.ts'],
  swaggerDefinition, // Use static path to avoid __filename ReferenceError
};
const swaggerSpec = swaggerJSDoc(swaggerOptions);

/**
 * API key authentication middleware
 * Reads valid API keys from process.env.API_KEYS (comma-separated)
 * Skips /health and /api-docs endpoints
 * @param req
 * @param res
 * @param next
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
      const healthChecks = services.storageAdapters.map(adapter => adapter.healthCheck());
      const results = await Promise.all(healthChecks);
      const allHealthy = results.every(healthy => healthy);

      if (!allHealthy) {
        return res.status(503).json({
          details: services.storageAdapters.map((adapter, i) => ({
            adapter: adapter.constructor.name,
            healthy: results[i],
          })),
          status: 'error',
          storage: 'unhealthy',
        });
      }

      res.json({
        status: 'ok',
        storage: 'healthy',
        version: process.env.npm_package_version || 'dev',
      });
    } catch (err) {
      res.status(503).json({
        message: err instanceof Error ? err.message : String(err),
        status: 'error',
        storage: 'unhealthy',
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
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      // This is a comment to help the apply model.
      // Parse and validate query params
      const querySchema = z.object({
        category: z.string().optional(),
        isTemplate: z
          .string()
          .optional()
          .transform(v => (v === 'true' ? true : v === 'false' ? false : undefined)),
        limit: z
          .string()
          .optional()
          .transform(v => (v ? parseInt(v, 10) : 20)),
        offset: z
          .string()
          .optional()
          .transform(v => (v ? parseInt(v, 10) : 0)),
        order: z.enum(['asc', 'desc']).optional(),
        search: z.string().optional(),
        sort: z.enum(['createdAt', 'updatedAt', 'name']).optional(),
        tags: z.string().optional(),
      });
      const parseResult = querySchema.safeParse(req.query);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            details: parseResult.error.errors,
            message: 'Invalid query parameters',
          },
          success: false,
        });
        return;
      }
      const { offset, limit, sort, order, category, tags, isTemplate, search } = parseResult.data;
      const options: any = { category, isTemplate, limit, offset, order, search, sort };
      if (tags) {
        options.tags = tags
          .split(',')
          .map((t: string) => t.trim())
          .filter(Boolean);
      }
      const prompts = await services.promptService.listPrompts(options);
      // For total count, fetch without pagination
      const total = (
        await services.promptService.listPrompts({ ...options, limit: undefined, offset: 0 })
      ).length;
      res.json({ limit, offset, prompts, total });
    }),
  );

  /**
   * POST /prompts
   * Create a new prompt version. If version is not specified, auto-increment.
   */
  app.post(
    '/prompts',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const parseResult = promptSchemas.create.safeParse(req.body);
      if (!parseResult.success) {
        // Forward validation error to the global handler
        return next(new z.ZodError(parseResult.error.errors));
      }
      const prompt = parseResult.data;
      const created = await services.promptService.createPrompt(prompt);
      return res.status(201).json({ prompt: created, success: true });
    }),
  );

  /**
   * GET /prompts/:id
   * Get a prompt by id and optional version.
   */
  app.get(
    '/prompts/:id',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const id = req.params.id;
      const version = req.query.version ? Number(req.query.version) : undefined;
      const prompt = await services.promptService.getPrompt(id, version);
      if (!prompt) {
        return res
          .status(404)
          .json({ error: { code: 'NOT_FOUND', message: 'Prompt not found' }, success: false });
      }
      return res.status(200).json({ prompt, success: true });
    }),
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
  app.put(
    '/prompts/:id/:version',
    catchAsync(async (req, res, next) => {
      const prompt = await services.promptService.updatePrompt(
        req.params.id,
        parseInt(req.params.version, 10),
        req.body,
      );
      res.json({ prompt });
    }),
  );

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
  app.delete(
    '/prompts/:id/:version',
    catchAsync(async (req, res, next) => {
      await services.promptService.deletePrompt(req.params.id, parseInt(req.params.version, 10));
      res.status(204).send();
    }),
  );

  /**
   * GET /prompts/:id/versions
   * List all versions for a prompt ID
   */
  app.get(
    '/prompts/:id/versions',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const versions = await services.promptService.listPromptVersions(req.params.id);
      res.json({ id: req.params.id, success: true, versions });
    }),
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
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const parseResult = promptSchemas.bulkCreate.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            details: parseResult.error.errors,
            message: 'Invalid bulk prompt data',
          },
          success: false,
        });
        return;
      }
      const results = await services.promptService.createPromptsBulk(parseResult.data);
      res.status(200).json(results);
    }),
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
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const parseResult = promptSchemas.bulkDelete.safeParse(req.body);
      if (!parseResult.success) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            details: parseResult.error.errors,
            message: 'Invalid bulk delete data',
          },
          success: false,
        });
        return;
      }
      const results = await services.promptService.deletePromptsBulk(parseResult.data.ids);
      res.status(200).json(results);
    }),
  );

  app.get(
    '/api/v1/sequence/:id',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const { id } = req.params;
      const result = await services.sequenceService.getSequenceWithPrompts(id);
      res.json(result);
    }),
  );

  // Add after other endpoints, before the 404 handler
  app.post(
    '/diagram',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
    }),
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
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const workflow = req.body;
      if (!services.workflowService.validateWorkflow(workflow)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid workflow definition.',
          },
          success: false,
        });
        return;
      }
      if (!workflow.id || typeof workflow.id !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Workflow must have a string id.',
          },
          success: false,
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
          error: {
            code: 'CONFLICT',
            message: `Workflow version ${version} already exists for id ${workflow.id}`,
          },
          success: false,
        });
        return;
      }
      saveWorkflowToFile(workflow);
      res.status(201).json({
        id: workflow.id,
        message: 'Workflow version saved.',
        success: true,
        version,
      });
    }),
  );

  /**
   * GET /api/v1/workflows/:id
   * Retrieve the latest version of a workflow by ID
   * Response: { ...workflow } or 404
   */
  app.get(
    '/api/v1/workflows/:id',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const workflow = loadWorkflowFromFile(req.params.id);
      if (!workflow) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Workflow not found.',
          },
          success: false,
        });
        return;
      }
      res.json(workflow);
    }),
  );

  /**
   * GET /api/v1/workflows/:id/versions
   * List all versions for a workflow ID
   * Response: [ { version, createdAt } ]
   */
  app.get(
    '/api/v1/workflows/:id/versions',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const versions = getAllWorkflowVersions(req.params.id);
      if (!versions.length) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'No versions found for workflow.',
          },
          success: false,
        });
        return;
      }
      // Optionally, include createdAt for each version
      const result = versions.map(v => {
        const wf = loadWorkflowFromFile(req.params.id, v);
        return { createdAt: wf?.createdAt, version: v };
      });
      res.json(result);
    }),
  );

  /**
   * GET /api/v1/workflows/:id/versions/:version
   * Retrieve a specific version of a workflow
   * Response: { ...workflow } or 404
   */
  app.get(
    '/api/v1/workflows/:id/versions/:version',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const version = parseInt(req.params.version, 10);
      if (isNaN(version)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Version must be a number.',
          },
          success: false,
        });
        return;
      }
      const workflow = loadWorkflowFromFile(req.params.id, version);
      if (!workflow) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Workflow version not found.',
          },
          success: false,
        });
        return;
      }
      res.json(workflow);
    }),
  );

  /**
   * DELETE /api/v1/workflows/:id/versions/:version
   * Delete a specific version of a workflow
   * Response: { success, id, version, message }
   */
  app.delete(
    '/api/v1/workflows/:id/versions/:version',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const version = parseInt(req.params.version, 10);
      if (isNaN(version)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Version must be a number.',
          },
          success: false,
        });
        return;
      }
      const file = getWorkflowFileName(req.params.id, version);
      if (!fs.existsSync(file)) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Workflow version not found.',
          },
          success: false,
        });
        return;
      }
      fs.unlinkSync(file);
      res.json({
        id: req.params.id,
        message: 'Workflow version deleted.',
        success: true,
        version,
      });
    }),
  );

  /**
   * GET /api/v1/workflows
   * List all workflows (latest version only)
   * Response: [ { ...workflow }, ... ]
   */
  app.get(
    '/api/v1/workflows',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const workflows = getAllWorkflows(true); // latestOnly = true
      res.json(workflows);
    }),
  );

  /**
   * POST /api/v1/workflows/:id/run
   * Optionally accepts ?version= in query to run a specific version
   * Response: { success, message, outputs } or 404
   */
  app.post(
    '/api/v1/workflows/:id/run',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const userId = (req.headers['x-user-id'] as string) || 'anonymous';
      const workflowId = req.params.id;
      const versionParam = req.query.version;
      let version: number | undefined = undefined;
      if (versionParam !== undefined) {
        version = parseInt(versionParam as string, 10);
        if (isNaN(version)) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Version must be a number.',
            },
            success: false,
          });
          return;
        }
      }
      if (!checkWorkflowRateLimit(userId)) {
        res.status(429).json({
          error: {
            code: 'RATE_LIMIT',
            message: 'Too many concurrent workflows. Please wait and try again.',
          },
          success: false,
        });
        return;
      }
      let result;
      try {
        const workflow = loadWorkflowFromFile(workflowId, version);
        if (!workflow) {
          res.status(404).json({
            error: {
              code: 'NOT_FOUND',
              message: 'Workflow not found.',
            },
            success: false,
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
    }),
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
    catchAsync(async (req, res, next) => {
      const { executionId } = req.params;
      const { input } = req.body;
      const result = await services.workflowService.resumeWorkflow(executionId, input);
      res.status(200).json(result);
    }),
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
      error: {
        code: HttpErrorCode.NOT_FOUND,
        message: 'Resource not found',
      },
      success: false,
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
        error: response,
        success: false,
      });
    }

    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: HttpErrorCode.VALIDATION_ERROR,
          details: err.issues,
          message: 'Invalid input data.',
        },
        success: false,
      });
    }

    // Log unexpected errors for debugging
    // In production, use a structured logger like Pino or Winston
    console.error('UNHANDLED_ERROR:', err);

    res.status(500).json({
      error: {
        code: HttpErrorCode.INTERNAL_SERVER_ERROR,
        message: 'An unexpected internal server error occurred.',
      },
      success: false,
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
