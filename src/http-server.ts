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
import catalog from '@sparesparrow/mcp-prompts-catalog';

import type { PromptService } from './prompt-service.js';
import type { ISequenceApplication } from './sequence-service.js';
import type { IWorkflowApplication } from './workflow-service.js';
import { AppError, HttpErrorCode } from './errors.js';
import {
  auditLogWorkflowEvent,
  getWorkflowRateLimiter,
  HttpRunner,
  PromptRunner,
  releaseWorkflowSlot,
  ShellRunner,
} from './workflow-service.js';
import type { StorageAdapter } from '@core/types/manual-exports.js';
import { promptSchemas } from '@core/types/manual-exports.js';
import { Prompt, CreatePromptParams, UpdatePromptParams } from '../../packages/core/src/interfaces.js';
import { atomicWriteFile } from './adapters.js';
import type { IPromptRepository, IPromptApplication } from '../../packages/core/src/interfaces.js';

// Global error handler middleware (must be at module level for export)
export const errorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  console.error(err);
  if (err instanceof z.ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data.',
        details: err.errors,
      },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: 'details' in err ? (err as any).details : undefined,
      },
    });
    return;
  }
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};

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
  promptService: IPromptApplication;
  sequenceService: ISequenceApplication;
  workflowService: IWorkflowApplication;
  storageAdapters: IPromptRepository[];
  elevenLabsService?: any;
}

const WORKFLOW_DIR = path.resolve(process.cwd(), 'data', 'workflows');
function ensureWorkflowDir() {
  if (!fs.existsSync(WORKFLOW_DIR)) fs.mkdirSync(WORKFLOW_DIR, { recursive: true });
}

function getWorkflowFileName(id: string, version: number) {
  return path.join(WORKFLOW_DIR, `${id}-v${version}.json`);
}

async function saveWorkflowToFile(workflow: any) {
  ensureWorkflowDir();
  if (typeof workflow.id !== 'string' || typeof workflow.version !== 'number') {
    throw new Error('Workflow must have string id and number version');
  }
  await atomicWriteFile(
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

// Helper function to sanitize prompt data for creation
const sanitizePromptData = (data: any): CreatePromptParams => ({
  name: typeof data.name === 'string' ? data.name : '',
  content: typeof data.content === 'string' ? data.content : '',
  isTemplate: Boolean(data.isTemplate),
  tags: Array.isArray(data.tags) ? data.tags : undefined,
  metadata: (typeof data.metadata === 'object' && data.metadata !== null) ? data.metadata : undefined,
  variables: Array.isArray(data.variables) ? data.variables : undefined,
  category: typeof data.category === 'string' ? data.category : undefined,
  description: typeof data.description === 'string' ? data.description : undefined
});

// Utility type to ensure metadata is never null
type NoNullMetadata<T> = Omit<T, 'metadata'> & { metadata?: Record<string, unknown> };

const isStringArray = (arr: any[]): arr is string[] => arr.every(v => typeof v === 'string');
const isTemplateVariableArray = (arr: any[]): arr is { name: string }[] => arr.every(v => typeof v === 'object' && v !== null && typeof v.name === 'string');

const sanitizeUpdatePromptData = (data: any): NoNullMetadata<Omit<UpdatePromptParams, 'id' | 'version'>> => {
  const result: any = {
    name: typeof data.name === 'string' ? data.name : undefined,
    content: typeof data.content === 'string' ? data.content : undefined,
    isTemplate: typeof data.isTemplate === 'boolean' ? data.isTemplate : undefined,
    category: typeof data.category === 'string' ? data.category : undefined,
    description: typeof data.description === 'string' ? data.description : undefined
  };
  if (Array.isArray(data.tags)) {
    result.tags = data.tags;
  }
  if (!Array.isArray(result.tags)) {
    delete result.tags;
  }
  if (Array.isArray(data.variables)) {
    if (isStringArray(data.variables) || isTemplateVariableArray(data.variables)) {
      result.variables = data.variables;
    }
  }
  if (typeof data.metadata === 'object' && data.metadata !== null) {
    result.metadata = data.metadata;
  }
  return result;
};

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
    res.status(401).json({ error: 'Unauthorized: missing or invalid API key' });
    return;
  }
  next();
}

// Helper function to handle errors
const handleError = (error: any, res: Response) => {
  console.error(error);
  if (error instanceof Error) {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  } else {
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  }
};

// Add helper for dynamic tool/resource discovery
function discoverCatalogTools() {
  const tools = [];
  const categories = catalog.getCategories();
  for (const category of categories) {
    for (const promptName of catalog.listPrompts(category)) {
      const prompt = catalog.loadPrompt(promptName, category);
      if (!prompt) continue;
      // Heuristic: Expose as tool if tagged or has resource/tool metadata
      const tags = prompt.tags || [];
      const meta = prompt.metadata || {};
      if (
        tags.includes('resource-enabled') ||
        tags.includes('resource-integration') ||
        tags.includes('workflow') ||
        tags.includes('code-review') ||
        tags.includes('mcp-resources') ||
        tags.includes('multi-resource') ||
        tags.includes('integration') ||
        tags.includes('template-system') ||
        meta.resourcePatterns ||
        meta.requires ||
        meta.recommended_tools
      ) {
        tools.push({
          id: prompt.id,
          name: prompt.name,
          description: prompt.description,
          tags,
          variables: prompt.variables,
          metadata: meta,
          category,
        });
      }
    }
  }
  return tools;
}

// Helper to find a tool by ID
function findCatalogToolById(id: string) {
  const categories = catalog.getCategories();
  for (const category of categories) {
    for (const promptName of catalog.listPrompts(category)) {
      const prompt = catalog.loadPrompt(promptName, category);
      if (prompt && prompt.id === id) return { prompt, category };
    }
  }
  return null;
}

/**
 *
 * @param server
 * @param config
 * @param services
 * @returns
 */
export async function startHttpServer(
  server: any | null = null,
  config: HttpServerConfig,
  services: ServerServices,
): Promise<http.Server> {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin || '*' }));
  app.use(express.json());
  if (config.rateLimit) {
    app.use(rateLimit(config.rateLimit));
  }
  app.use(apiKeyAuth); // Apply API key authentication to all routes

  // Swagger docs
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  const { promptService, sequenceService, workflowService } = services;

  // Routes

  /**
   * @openapi
   * /health:
   *   get:
   *     summary: Health check
   *     responses:
   *       200:
   *         description: Server is healthy
   */
  app.get('/health', function (_req, res) { res.status(200).send('OK'); });

  // --- Prompts ---

  // Create prompt handler
  app.post('/api/v1/prompts', async (req: Request, res: Response) => {
    try {
      const validatedData = sanitizePromptData(req.body);
      const prompt = await promptService.addPrompt(validatedData);
      res.status(201).json(prompt);
    } catch (error) {
      handleError(error, res);
    }
  });

  // Create prompts bulk handler
  app.post('/api/v1/prompts/bulk', async (req: Request, res: Response) => {
    try {
      const prompts = req.body.map(sanitizePromptData);
      const results = await Promise.all(prompts.map((p: CreatePromptParams) => promptService.addPrompt(p)));
      res.status(201).json(results);
    } catch (error) {
      handleError(error, res);
    }
  });

  // Update prompt handler
  app.patch('/api/v1/prompts/:id', async (req: Request, res: Response) => {
    try {
      const version = parseInt(req.query.version as string, 10);
      if (isNaN(version)) {
        throw new Error('Version parameter is required and must be a number');
      }
      let validatedData = promptSchemas.update.parse(req.body);
      // Sanitize updateData for metadata, tags, and variables
      const sanitizedUpdateData = { ...validatedData };
      if ('metadata' in sanitizedUpdateData && (sanitizedUpdateData.metadata === null || sanitizedUpdateData.metadata === undefined)) {
        delete sanitizedUpdateData.metadata;
      }
      if ('tags' in sanitizedUpdateData && (sanitizedUpdateData.tags === null || sanitizedUpdateData.tags === undefined)) {
        delete sanitizedUpdateData.tags;
      }
      if ('variables' in sanitizedUpdateData && (sanitizedUpdateData.variables === null || sanitizedUpdateData.variables === undefined)) {
        delete sanitizedUpdateData.variables;
      }
      // Explicitly construct update object for type safety
      const updateObj: Partial<Prompt> = {};
      if (sanitizedUpdateData.name !== undefined && sanitizedUpdateData.name !== null) updateObj.name = sanitizedUpdateData.name;
      if (sanitizedUpdateData.description !== undefined && sanitizedUpdateData.description !== null) updateObj.description = sanitizedUpdateData.description;
      if (sanitizedUpdateData.category !== undefined && sanitizedUpdateData.category !== null) updateObj.category = sanitizedUpdateData.category;
      if (sanitizedUpdateData.content !== undefined && sanitizedUpdateData.content !== null) updateObj.content = sanitizedUpdateData.content;
      if (sanitizedUpdateData.isTemplate !== undefined && sanitizedUpdateData.isTemplate !== null) updateObj.isTemplate = sanitizedUpdateData.isTemplate;
      if (sanitizedUpdateData.metadata !== undefined && sanitizedUpdateData.metadata !== null) updateObj.metadata = sanitizedUpdateData.metadata;
      if (sanitizedUpdateData.tags !== undefined && sanitizedUpdateData.tags !== null) updateObj.tags = sanitizedUpdateData.tags;
      if (sanitizedUpdateData.variables !== undefined && sanitizedUpdateData.variables !== null) updateObj.variables = sanitizedUpdateData.variables;
      const updated = await promptService.updatePrompt(
        req.params.id,
        version,
        updateObj
      );
      res.json(updated);
    } catch (error) {
      handleError(error, res);
    }
  });

  /**
   * @openapi
   * /prompts:
   *   get:
   *     summary: List prompts
   *     responses:
   *       200:
   *         description: A list of prompts
   */
  app.get(
    '/prompts',
    catchAsync(async (req, res) => {
      const { tags, isTemplate, search, limit, offset } = promptSchemas.list.parse(req.query);
      const prompts = await promptService.listPrompts({
        tags: tags as string[],
        isTemplate: isTemplate as boolean,
        search: search as string,
        limit: limit as number,
        offset: offset as number,
      });
      res.status(200).json(prompts);
    }),
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
   *         description: The prompt
   *       404:
   *         description: Prompt not found
   */
  app.get(
    '/prompts/:id',
    catchAsync(async (req, res) => {
      const { id } = req.params;
      const prompt = await promptService.getPrompt(id);
      if (!prompt) {
        throw new AppError('Prompt not found', 404, HttpErrorCode.NOT_FOUND);
      }
      res.status(200).json(prompt);
    }),
  );

  /**
   * @openapi
   * /prompts/{id}/versions:
   *  get:
   *    summary: Get all versions of a prompt
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        schema:
   *          type: string
   *    responses:
   *      200:
   *        description: A list of versions
   *      404:
   *        description: Prompt not found
   */
  app.get(
    '/prompts/:id/versions',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const versions = await services.promptService.listPromptVersions(req.params.id);
      res.json({ success: true, id: req.params.id, versions });
    }),
  );

  /**
   * @openapi
   * /prompts/bulk-delete:
   *   post:
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
   *       207:
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
  app.post(
    '/prompts/bulk-delete',
    catchAsync(async (req, res) => {
      const { ids } = req.body;
      if (!Array.isArray(ids)) {
        throw new AppError('`ids` must be an array of strings', 400, HttpErrorCode.VALIDATION_ERROR);
      }
      const results = await Promise.all(ids.map(id => promptService.deletePrompt(id)));
      res.status(200).json({ results });
    }),
  );

  app.get(
    '/api/v1/sequence/:id',
    catchAsync(async (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const { id } = req.params;
      const versions = await promptService.listPromptVersions(id);
      res.status(200).json(versions);
    }),
  );

  /**
   * @openapi
   * /prompts/{id}/{version}:
   *  get:
   *   summary: Get a specific version of a prompt
   *   parameters:
   *    - in: path
   *      name: id
   *      required: true
   *      schema:
   *       type: string
   *    - in: path
   *      name: version
   *      required: true
   *      schema:
   *        type: integer
   *   responses:
   *    200:
   *     description: The prompt
   *    404:
   *      description: Prompt not found
   */
  app.get(
    '/prompts/:id/:version',
    catchAsync(async (req, res) => {
      const { id } = req.params;
      const version = parseInt(req.params.version, 10);
      const prompt = await promptService.getPrompt(id, version);
      if (!prompt) {
        throw new AppError('Prompt not found', 404, HttpErrorCode.NOT_FOUND);
      }
      res.status(200).json(prompt);
    }),
  );

  /**
   * @openapi
   * /prompts/{id}/{version}:
   *  put:
   *    summary: Update a prompt
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        schema:
   *          type: string
   *      - in: path
   *        name: version
   *        required: true
   *        schema:
   *          type: integer
   *    requestBody:
   *      required: true
   *      content:
   *        application/json:
   *          schema:
   *            $ref: '#/components/schemas/Prompt'
   *    responses:
   *      200:
   *        description: The updated prompt
   *      404:
   *        description: Prompt not found
   */
  app.put(
    '/prompts/:id/:version',
    catchAsync(async (req, res) => {
      let validatedData = promptSchemas.update.parse(req.body);
      // Sanitize updateData for metadata, tags, and variables
      const sanitizedUpdateData = { ...validatedData };
      if ('metadata' in sanitizedUpdateData && (sanitizedUpdateData.metadata === null || sanitizedUpdateData.metadata === undefined)) {
        delete sanitizedUpdateData.metadata;
      }
      if ('tags' in sanitizedUpdateData && (sanitizedUpdateData.tags === null || sanitizedUpdateData.tags === undefined)) {
        delete sanitizedUpdateData.tags;
      }
      if ('variables' in sanitizedUpdateData && (sanitizedUpdateData.variables === null || sanitizedUpdateData.variables === undefined)) {
        delete sanitizedUpdateData.variables;
      }
      // Explicitly construct update object for type safety
      const updateObj: Partial<Prompt> = {};
      if (sanitizedUpdateData.name !== undefined && sanitizedUpdateData.name !== null) updateObj.name = sanitizedUpdateData.name;
      if (sanitizedUpdateData.description !== undefined && sanitizedUpdateData.description !== null) updateObj.description = sanitizedUpdateData.description;
      if (sanitizedUpdateData.category !== undefined && sanitizedUpdateData.category !== null) updateObj.category = sanitizedUpdateData.category;
      if (sanitizedUpdateData.content !== undefined && sanitizedUpdateData.content !== null) updateObj.content = sanitizedUpdateData.content;
      if (sanitizedUpdateData.isTemplate !== undefined && sanitizedUpdateData.isTemplate !== null) updateObj.isTemplate = sanitizedUpdateData.isTemplate;
      if (sanitizedUpdateData.metadata !== undefined && sanitizedUpdateData.metadata !== null) updateObj.metadata = sanitizedUpdateData.metadata;
      if (sanitizedUpdateData.tags !== undefined && sanitizedUpdateData.tags !== null) updateObj.tags = sanitizedUpdateData.tags;
      if (sanitizedUpdateData.variables !== undefined && sanitizedUpdateData.variables !== null) updateObj.variables = sanitizedUpdateData.variables;
      const version = parseInt(req.params.version, 10);
      const updated = await promptService.updatePrompt(req.params.id, version, updateObj);
      res.status(200).json({ success: true, prompt: updated });
    }),
  );

  /**
   * @openapi
   * /prompts/{id}/{version}:
   *  delete:
   *    summary: Delete a prompt
   *    parameters:
   *      - in: path
   *        name: id
   *        required: true
   *        schema:
   *          type: string
   *      - in: path
   *        name: version
   *        required: false
   *        schema:
   *          type: integer
   *    responses:
   *      204:
   *        description: Prompt deleted
   *      404:
   *        description: Prompt not found
   */
  app.delete(
    '/prompts/:id/:version?',
    catchAsync(async (req, res) => {
      const { id } = req.params;
      const version = req.params.version ? parseInt(req.params.version, 10) : undefined;
      const success = await promptService.deletePrompt(id, version);
      if (!success) {
        throw new AppError('Prompt not found', 404, HttpErrorCode.NOT_FOUND);
      }
      res.status(204).send();
    }),
  );

  /**
   * @openapi
   * /prompts/apply-template:
   *   post:
   *     summary: Apply a template
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               id:
   *                 type: string
   *               variables:
   *                 type: object
   *     responses:
   *       200:
   *         description: The result of applying the template
   */
  app.post(
    '/prompts/apply-template',
    catchAsync(async (req, res) => {
      const { id, variables } = promptSchemas.applyTemplate.parse(req.body);
      const result = await promptService.applyTemplate(id, variables);
      res.status(200).json(result);
    }),
  );

  // --- Sequences ---

  app.post(
    '/sequences',
    catchAsync(async (req, res) => {
      // Assuming a schema for creating sequences exists
      // const validatedData = sequenceSchemas.create.parse(req.body);
      const sequence = await sequenceService.createSequence(req.body);
      res.status(201).json(sequence);
    }),
  );

  app.get(
    '/sequences/:id',
    catchAsync(async (req, res) => {
      const sequence = await sequenceService.getSequence(req.params.id);
      if (!sequence) {
        throw new AppError('Sequence not found', 404, HttpErrorCode.NOT_FOUND);
      }
      res.status(200).json(sequence);
    }),
  );

  app.post(
    '/sequences/:id/execute',
    catchAsync(async (req, res) => {
      const result = await sequenceService.executeSequence(req.params.id, req.body.variables);
      res.status(200).json(result);
    }),
  );

  // --- Workflows ---

  app.post(
    '/workflows',
    catchAsync(async (req, res) => {
      // const validatedWorkflow = workflowService.validateWorkflow(req.body);
      // const workflow = await workflowService.saveWorkflow(validatedWorkflow);
      const workflow = req.body;
      saveWorkflowToFile(workflow);
      res.status(201).json(workflow);
    }),
  );

  app.get(
    '/workflows',
    catchAsync(async (req, res) => {
      const latestOnly = req.query.latestOnly !== 'false';
      const workflows = getAllWorkflows(latestOnly);
      res.status(200).json(workflows);
    }),
  );

  app.get(
    '/workflows/:id',
    catchAsync(async (req, res) => {
      const workflow = loadWorkflowFromFile(req.params.id);
      if (!workflow) {
        throw new AppError('Workflow not found', 404, HttpErrorCode.NOT_FOUND);
      }
      res.status(200).json(workflow);
    }),
  );

  app.get(
    '/workflows/:id/versions',
    catchAsync(async (req, res) => {
      const versions = getAllWorkflowVersions(req.params.id);
      res.status(200).json(versions);
    }),
  );

  app.get(
    '/workflows/:id/:version',
    catchAsync(async (req, res) => {
      const version = parseInt(req.params.version, 10);
      const workflow = loadWorkflowFromFile(req.params.id, version);
      if (!workflow) {
        throw new AppError('Workflow not found', 404, HttpErrorCode.NOT_FOUND);
      }
      res.status(200).json(workflow);
    }),
  );

  // Express middleware for workflow rate limiting
  function workflowRateLimiter(req: express.Request, res: express.Response, next: express.NextFunction): void {
    const userId = req.body?.userId || req.query?.userId || req.header('x-user-id') || 'anonymous';
    const rateLimiter = getWorkflowRateLimiter();
    if (!rateLimiter(userId)) {
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }
    next();
  }

  app.post(
    '/workflows/:id/execute',
    workflowRateLimiter,
    catchAsync(async (req, res, next) => {
      const { id } = req.params;
      const version = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
      const workflow = loadWorkflowFromFile(id, version);
      if (!workflow) {
        throw new AppError('Workflow not found', 404, HttpErrorCode.NOT_FOUND);
      }
      const executionId = await workflowService.executeWorkflow(workflow, req.body.context);
      res.status(202).json({
        message: 'Workflow execution started',
        executionId: executionId,
        statusUrl: `/workflows/executions/${executionId}`,
      });
    }),
  );

  app.get(
    '/workflows/executions/:executionId',
    catchAsync(async (req, res) => {
      const { executionId } = req.params;
      const state = await workflowService.getWorkflowState(executionId);
      if (!state) {
        throw new AppError('Workflow execution not found', 404, HttpErrorCode.NOT_FOUND);
      }
      res.status(200).json(state);
    }),
  );

  app.post(
    '/workflows/executions/:executionId/pause',
    catchAsync(async (req, res) => {
      await workflowService.pauseWorkflow(req.params.executionId);
      res.status(200).json({ message: 'Workflow paused' });
    }),
  );

  app.post(
    '/workflows/executions/:executionId/resume',
    catchAsync(async (req, res) => {
      await workflowService.resumeWorkflow(req.params.executionId, req.body.context);
      res.status(200).json({ message: 'Workflow resumed' });
    }),
  );

  app.post(
    '/workflows/executions/:executionId/cancel',
    catchAsync(async (req, res) => {
      await workflowService.cancelWorkflow(req.params.executionId);
      res.status(200).json({ message: 'Workflow cancelled' });
    }),
  );

  // --- ElevenLabs Audio Generation ---
  if (services.elevenLabsService) {
    app.post(
      '/audio/generate',
      catchAsync(async (req, res) => {
        const { text, voiceId, modelId } = req.body;
        if (!text) {
          throw new AppError('Text is required for audio generation', 400, HttpErrorCode.VALIDATION_ERROR);
        }
        const { audioData, metadata } = await services.elevenLabsService.generateAudio({
          text,
          voiceId,
          modelId,
        });
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="generated_audio.mp3"');
        res.setHeader('X-Audio-Duration-Seconds', metadata.duration);
        res.setHeader('X-Audio-Word-Count', metadata.wordCount);
        res.setHeader('X-Audio-Character-Count', metadata.charCount);
        res.status(200).send(audioData);
      }),
    );
  }

  // JSON-RPC 2.0 Handler
  // @ts-expect-error Express async handler type mismatch is safe to ignore
  app.post('/rpc', async (req: Request, res: Response) => {
    const { jsonrpc, id, method, params } = req.body || {};
    if (jsonrpc !== '2.0' || typeof id === 'undefined' || typeof method !== 'string') {
      res.json({
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32600, message: 'Invalid Request' },
      });
      return;
    }

    // Helper to send JSON-RPC error
    const sendError = (code: number, message: string, data?: any) =>
      res.json({ jsonrpc: '2.0', id, error: { code, message, data } });

    try {
      // Dispatcher for supported methods
      switch (method) {
        case 'getCapabilities': {
          res.json({
            jsonrpc: '2.0',
            id,
            result: {
              server: 'mcp-prompts',
              version: '1.0.0',
              features: [
                'prompts.list',
                'prompts.get',
                'prompts.create',
                'prompts.update',
                'prompts.delete',
                'workflows.list',
                'workflows.execute',
                'tools.list',
                'tools.invoke',
                'consent',
              ],
              methods: [
                'getCapabilities',
                'prompts.list',
                'prompts.get',
                'prompts.create',
                'prompts.update',
                'prompts.delete',
                'workflows.list',
                'workflows.execute',
                'tools.list',
                'tools.invoke',
                'consent',
              ],
              protocol: 'MCP',
            },
          });
          return;
        }
        case 'prompts.list': {
          const { tags, isTemplate, search, limit, offset } = params || {};
          const prompts = await promptService.listPrompts({ tags, isTemplate, search, limit, offset });
          res.json({ jsonrpc: '2.0', id, result: prompts });
          return;
        }
        case 'prompts.get': {
          const { id: promptId, version } = params || {};
          if (!promptId) return sendError(-32602, 'Missing prompt id');
          const prompt = await promptService.getPrompt(promptId, version);
          if (!prompt) return sendError(-32004, 'Prompt not found');
          res.json({ jsonrpc: '2.0', id, result: prompt });
          return;
        }
        case 'prompts.create': {
          const data = params || {};
          const validatedData = sanitizePromptData(data);
          const prompt = await promptService.addPrompt(validatedData);
          res.json({ jsonrpc: '2.0', id, result: prompt });
          return;
        }
        case 'prompts.update': {
          const { id: promptId, version, ...updateData } = params || {};
          if (!promptId || typeof version !== 'number') return sendError(-32602, 'Missing prompt id or version');
          // Sanitize updateData for metadata, tags, and variables
          const sanitizedUpdateData = { ...updateData };
          if ('metadata' in sanitizedUpdateData && (sanitizedUpdateData.metadata === null || sanitizedUpdateData.metadata === undefined)) {
            delete sanitizedUpdateData.metadata;
          }
          if ('tags' in sanitizedUpdateData && (sanitizedUpdateData.tags === null || sanitizedUpdateData.tags === undefined)) {
            delete sanitizedUpdateData.tags;
          }
          if ('variables' in sanitizedUpdateData && (sanitizedUpdateData.variables === null || sanitizedUpdateData.variables === undefined)) {
            delete sanitizedUpdateData.variables;
          }
          // Explicitly construct update object for type safety
          const updateObj: Partial<Prompt> = {};
          if (sanitizedUpdateData.name !== undefined && sanitizedUpdateData.name !== null) updateObj.name = sanitizedUpdateData.name;
          if (sanitizedUpdateData.description !== undefined && sanitizedUpdateData.description !== null) updateObj.description = sanitizedUpdateData.description;
          if (sanitizedUpdateData.category !== undefined && sanitizedUpdateData.category !== null) updateObj.category = sanitizedUpdateData.category;
          if (sanitizedUpdateData.content !== undefined && sanitizedUpdateData.content !== null) updateObj.content = sanitizedUpdateData.content;
          if (sanitizedUpdateData.isTemplate !== undefined && sanitizedUpdateData.isTemplate !== null) updateObj.isTemplate = sanitizedUpdateData.isTemplate;
          if (sanitizedUpdateData.metadata !== undefined && sanitizedUpdateData.metadata !== null) updateObj.metadata = sanitizedUpdateData.metadata;
          if (sanitizedUpdateData.tags !== undefined && sanitizedUpdateData.tags !== null) updateObj.tags = sanitizedUpdateData.tags;
          if (sanitizedUpdateData.variables !== undefined && sanitizedUpdateData.variables !== null) updateObj.variables = sanitizedUpdateData.variables;
          const updated = await promptService.updatePrompt(promptId, version, updateObj);
          res.json({ jsonrpc: '2.0', id, result: updated });
          return;
        }
        case 'prompts.delete': {
          const { id: promptId, version } = params || {};
          if (!promptId) return sendError(-32602, 'Missing prompt id');
          const success = await promptService.deletePrompt(promptId, version);
          if (!success) return sendError(-32004, 'Prompt not found');
          res.json({ jsonrpc: '2.0', id, result: { success: true } });
          return;
        }
        case 'workflows.list': {
          const latestOnly = params?.latestOnly !== false;
          const workflows = getAllWorkflows(latestOnly);
          res.json({ jsonrpc: '2.0', id, result: workflows });
          return;
        }
        case 'workflows.execute': {
          const { id: workflowId, version, context } = params || {};
          if (!workflowId) return sendError(-32602, 'Missing workflow id');
          const workflow = loadWorkflowFromFile(workflowId, version);
          if (!workflow) return sendError(-32004, 'Workflow not found');
          const executionId = await workflowService.executeWorkflow(workflow, context);
          res.json({ jsonrpc: '2.0', id, result: { executionId } });
          return;
        }
        case 'tools.list': {
          // Dynamic discovery from catalog
          const tools = discoverCatalogTools();
          res.json({ jsonrpc: '2.0', id, result: tools });
          return;
        }
        case 'tools.invoke': {
          const { tool: toolId, args } = params || {};
          if (!toolId) return sendError(-32602, 'Missing tool id');
          const found = findCatalogToolById(toolId);
          if (!found) return sendError(-32004, 'Tool not found');
          const { prompt } = found;
          if (prompt.isTemplate && prompt.variables) {
            // Render template with args
            try {
              // Simple variable mapping: support both string[] and object[]
              const variables: Record<string, any> = {};
              for (const v of prompt.variables) {
                const name = typeof v === 'string' ? v : v.name;
                if (args && (args as Record<string, any>)[name] !== undefined) variables[name] = (args as Record<string, any>)[name];
              }
              // Use Handlebars directly for now (no partials)
              const Handlebars = require('handlebars');
              const template = Handlebars.compile(prompt.content);
              const content = template(variables);
              res.json({ jsonrpc: '2.0', id, result: { content } });
            } catch (e) {
              const errorMessage = e instanceof Error ? e.message : String(e);
              sendError(-32002, 'Tool invocation failed', { error: errorMessage });
            }
            return;
          } else {
            sendError(-32001, 'Tool is not a template or cannot be invoked directly');
            return;
          }
        }
        case 'consent': {
          const { userId, action, details } = params || {};
          if (!userId || !action) return sendError(-32602, 'Missing userId or action');
          auditLogWorkflowEvent({ userId, workflowId: '', eventType: 'consent', details: { action, ...details } });
          res.json({ jsonrpc: '2.0', id, result: { success: true } });
          return;
        }
        default:
          sendError(-32601, 'Method not found');
          return;
      }
    } catch (error: any) {
      // Log error and return JSON-RPC error
      console.error('JSON-RPC error:', error);
      sendError(-32603, error.message || 'Internal error', error.stack);
      return;
    }
  });

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

  app.use(errorHandler);

  // Ensure the function always returns a Promise<http.Server>
  // If a server instance is provided, return it; otherwise, start a new server
  if (server) {
    return Promise.resolve(server);
  }

  return new Promise((resolve, reject) => {
    const srv = http.createServer(app);

    srv.on('error', (error: NodeJS.ErrnoException) => {
      console.error('Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${config.port} is already in use`);
      }
      reject(error);
    });

    srv.on('listening', () => {
      const addr = srv.address();
      const boundAddress = typeof addr === 'string' ? addr : `${addr?.address}:${addr?.port}`;
      console.log(`Server is now listening on ${boundAddress}`);
      resolve(srv);
    });

    srv.listen(config.port, config.host);
  });
}
