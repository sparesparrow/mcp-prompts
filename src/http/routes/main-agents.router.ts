import { Router, Request, Response } from 'express';
import { MainAgentService } from '../../core/services/main-agent.service';
import { ValidationError, NotFoundError } from '../../core/errors/custom-errors';

export function createMainAgentsRouter(mainAgentService: MainAgentService): Router {
  const router = Router();

  /**
   * GET /v1/main-agents
   * List all main agent templates
   *
   * Query params:
   * - projectType: Filter by compatible project type
   * - limit: Maximum number of results (default: 50)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { projectType, limit } = req.query;

      const mainAgents = projectType
        ? [await mainAgentService.getMainAgentForProjectType(projectType as string)].filter(Boolean)
        : await mainAgentService.listMainAgents(limit ? parseInt(limit as string) : 50);

      res.json({
        mainAgents: mainAgents.map(m => m.toJSON()),
        total: mainAgents.length,
        filter: projectType ? { projectType } : null
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to list main agents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/main-agents/:id
   * Get a specific main agent template by ID
   */
  router.get('/:id(*)', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const mainAgent = await mainAgentService.getMainAgent(id);

      res.json({
        mainAgent: mainAgent.toJSON()
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to get main agent',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/main-agents/:id/configuration
   * Get full configuration for a main agent including subagents
   */
  router.get('/:id(*)/configuration', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const config = await mainAgentService.getFullConfiguration(id);

      res.json({
        mainAgent: config.mainAgent.toJSON(),
        subagents: config.subagents.map(s => s.toJSON()),
        mcpServers: config.mcpServers,
        estimatedCost: config.estimatedCost,
        estimatedTime: config.estimatedTime
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to get configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/main-agents/:id/subagents
   * Get subagents for a main agent
   */
  router.get('/:id(*)/subagents', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const subagents = await mainAgentService.getSubagents(id);

      res.json({
        subagents: subagents.map(s => s.toJSON()),
        total: subagents.length
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to get subagents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /v1/main-agents/:id/validate
   * Validate subagent configuration for a main agent
   */
  router.post('/:id(*)/validate', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const validation = await mainAgentService.validateSubagentConfiguration(id);

      res.json(validation);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to validate configuration',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /v1/main-agents/:id/system-prompt
   * Generate system prompt for main agent with optional context
   *
   * Body:
   * - customContext: string (optional)
   */
  router.post('/:id(*)/system-prompt', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { customContext } = req.body;

      const systemPrompt = await mainAgentService.generateSystemPrompt(
        id,
        customContext as string | undefined
      );

      res.json({
        systemPrompt,
        length: systemPrompt.length,
        estimatedTokens: Math.ceil(systemPrompt.length / 4)
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to generate system prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/main-agents/:id/preview
   * Get execution preview (dry-run) for a main agent
   *
   * Query params:
   * - projectType: Optional project type for context
   */
  router.get('/:id(*)/preview', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { projectType } = req.query;

      const preview = await mainAgentService.getExecutionPreview(
        id,
        projectType as string | undefined
      );

      res.json(preview);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to get preview',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
