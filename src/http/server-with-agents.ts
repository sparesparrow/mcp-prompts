#!/usr/bin/env node
/**
 * HTTP Server with Agent Orchestration Support
 *
 * This server includes the new agent orchestration endpoints
 * for subagents, main agents, and project templates.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { FilePromptRepository } from '../adapters/file/file-prompt-repository';
import { SQSAdapter } from '../adapters/aws/sqs-adapter';
import { PromptService } from '../core/services/prompt.service';
import { SubagentService } from '../core/services/subagent.service';
import { MainAgentService } from '../core/services/main-agent.service';
import { createSubagentsRouter } from './routes/subagents.router';
import { createMainAgentsRouter } from './routes/main-agents.router';

export async function createServerWithAgents(): Promise<express.Application> {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(morgan('combined'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize storage adapter
  // Use file storage for development (points to data/prompts)
  const promptsDir = process.env.PROMPTS_DIR || path.join(process.cwd(), 'data', 'prompts');
  const promptRepository = new FilePromptRepository(promptsDir);

  // Event bus (optional - use in-memory for development)
  const eventBus = process.env.PROCESSING_QUEUE
    ? new SQSAdapter(process.env.PROCESSING_QUEUE)
    : {
        publish: async () => {},
        healthCheck: async () => ({ status: 'healthy' as const })
      } as any;

  // Catalog repository (optional for now)
  const catalogRepository = {
    healthCheck: async () => ({ status: 'healthy' as const }),
    saveCatalogEntry: async () => {},
    getCatalogEntry: async () => null
  } as any;

  // Initialize services
  const promptService = new PromptService(promptRepository, catalogRepository, eventBus);
  const subagentService = new SubagentService(promptRepository, eventBus);
  const mainAgentService = new MainAgentService(promptRepository, subagentService, eventBus);

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const health = await promptRepository.healthCheck();

      res.status(health.status === 'healthy' ? 200 : 503).json({
        status: health.status,
        service: 'mcp-prompts-with-agents',
        storage: 'file',
        promptsDir,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'mcp-prompts-with-agents',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // API info endpoint
  app.get('/v1', (req, res) => {
    res.json({
      service: 'mcp-prompts',
      version: '1.0.0',
      features: [
        'prompt-management',
        'subagent-registry',
        'main-agent-templates',
        'project-orchestration'
      ],
      endpoints: {
        prompts: '/v1/prompts',
        subagents: '/v1/subagents',
        mainAgents: '/v1/main-agents'
      },
      documentation: '/api-docs'
    });
  });

  // Legacy prompt endpoints
  app.get('/v1/prompts', async (req, res) => {
    try {
      const { category, limit } = req.query;
      const prompts = category
        ? await promptService.getPromptsByCategory(category as string, parseInt(limit as string) || 50)
        : await promptService.getLatestPrompts(parseInt(limit as string) || 50);

      res.json({
        prompts: prompts.map(p => p.toJSON()),
        total: prompts.length
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch prompts',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/v1/prompts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { version } = req.query;

      const prompt = await promptService.getPrompt(id, version as string);

      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      res.json({ prompt: prompt.toJSON() });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // NEW: Agent orchestration routes
  app.use('/v1/subagents', createSubagentsRouter(subagentService));
  app.use('/v1/main-agents', createMainAgentsRouter(mainAgentService));

  // Stats endpoint
  app.get('/v1/stats', async (req, res) => {
    try {
      const allPrompts = await promptRepository.findLatestVersions(10000);

      const stats = {
        total: allPrompts.length,
        byType: {
          standard: allPrompts.filter(p => p.promptType === 'standard').length,
          subagent: allPrompts.filter(p => p.promptType === 'subagent_registry').length,
          mainAgent: allPrompts.filter(p => p.promptType === 'main_agent_template').length,
          projectTemplate: allPrompts.filter(p => p.promptType === 'project_orchestration_template').length
        },
        subagents: {
          total: allPrompts.filter(p => p.isSubagent()).length,
          categories: await promptRepository.getSubagentCategories(),
          models: await promptRepository.getAgentModels()
        }
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: 'Not found',
      path: req.path,
      method: req.method
    });
  });

  // Error handler
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message
    });
  });

  return app;
}

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const HOST = process.env.HOST || '0.0.0.0';

  createServerWithAgents().then(app => {
    app.listen(PORT, () => {
      console.log(`🚀 MCP Prompts Server (with agents) listening on http://${HOST}:${PORT}`);
      console.log(`   Prompts directory: ${process.env.PROMPTS_DIR || path.join(process.cwd(), 'data', 'prompts')}`);
      console.log(`   Health check: http://${HOST}:${PORT}/health`);
      console.log(`   API info: http://${HOST}:${PORT}/v1`);
      console.log(`   Subagents: http://${HOST}:${PORT}/v1/subagents`);
      console.log(`   Main agents: http://${HOST}:${PORT}/v1/main-agents`);
    });
  }).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
