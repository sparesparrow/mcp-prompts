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
  elevenLabsService?: any;
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
  app.get('/health', (_req, res) => res.status(200).send('OK'));

  // --- Prompts ---

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
   */
  app.put('/prompts/:id/:version', catchAsync(async (req, res, next) => {
    const prompt = await services.promptService.updatePrompt(
      req.params.id,
      parseInt(req.params.version, 10),
      req.body,
    );
    if (prompt) {
      res.status(200).json({ prompt });
    } else {
      res.status(404).json({ error: 'Prompt not found' });
    }
  }));

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
        throw new AppError('Prompt not found', HttpErrorCode.NOT_FOUND);
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
   * /prompts/bulk-create:
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
   *       207:
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
    '/prompts/bulk-create',
    catchAsync(async (req, res) => {
      const { prompts } = req.body;
      if (!Array.isArray(prompts)) {
        throw new AppError('`prompts` must be an array', 400, 'VALIDATION_ERROR');
      }
      const results = await services.promptService.createPromptsBulk(prompts);
      const hasErrors = results.some(r => !r.success);
      res.status(hasErrors ? 207 : 201).json({ results });
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
        throw new AppError('`ids` must be an array of strings', 400, 'VALIDATION_ERROR');
      }
      const results = await services.promptService.deletePromptsBulk(ids);
      const hasErrors = results.some(r => !r.success);
      res.status(hasErrors ? 207 : 200).json({ results });
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
        throw new AppError('Prompt not found', HttpErrorCode.NOT_FOUND);
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
      const { id } = req.params;
      const version = parseInt(req.params.version, 10);
      const validatedData = promptSchemas.update.parse(req.body);
      const prompt = await promptService.updatePrompt(id, version, validatedData);
      res.status(200).json(prompt);
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
        throw new AppError('Prompt not found', HttpErrorCode.NOT_FOUND);
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
        throw new AppError('Sequence not found', HttpErrorCode.NOT_FOUND);
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
        throw new AppError('Workflow not found', HttpErrorCode.NOT_FOUND);
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
        throw new AppError('Workflow not found', HttpErrorCode.NOT_FOUND);
      }
      res.status(200).json(workflow);
    }),
  );

  app.post(
    '/workflows/:id/execute',
    getWorkflowRateLimiter(),
    catchAsync(async (req, res, next) => {
      const { id } = req.params;
      const version = req.query.version ? parseInt(req.query.version as string, 10) : undefined;
      const workflow = loadWorkflowFromFile(id, version);
      if (!workflow) {
        throw new AppError('Workflow not found', HttpErrorCode.NOT_FOUND);
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
        throw new AppError('Workflow execution not found', HttpErrorCode.NOT_FOUND);
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
          throw new AppError('Text is required for audio generation', HttpErrorCode.BAD_REQUEST);
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
    console.error(err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data.',
          details: err.errors,
        },
      });
    }
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
          details: 'details' in err ? (err as any).details : undefined,
        },
      });
    }
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
      },
    });
  });
}
