import { Router, Request, Response } from 'express';
import { SubagentService } from '../../core/services/subagent.service';
import { ClaudeModel } from '../../core/entities/prompt.entity';
import { ValidationError, NotFoundError } from '../../core/errors/custom-errors';

export function createSubagentsRouter(subagentService: SubagentService): Router {
  const router = Router();

  /**
   * GET /v1/subagents
   * List all subagents with optional filtering
   *
   * Query params:
   * - category: Filter by category (dev, infra, quality, etc.)
   * - tags: Comma-separated list of tags
   * - model: Filter by Claude model (opus, sonnet, haiku)
   * - compatibleWith: Filter by project type compatibility
   * - limit: Maximum number of results (default: 100)
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const { category, tags, model, compatibleWith, limit } = req.query;

      const filter: any = {};
      if (category) filter.category = category as string;
      if (tags) filter.tags = (tags as string).split(',').map(t => t.trim());
      if (model) filter.model = model as ClaudeModel;
      if (compatibleWith) filter.compatibleWith = compatibleWith as string;

      const subagents = await subagentService.listSubagents(
        Object.keys(filter).length > 0 ? filter : undefined,
        limit ? parseInt(limit as string) : 100
      );

      res.json({
        subagents: subagents.map(s => s.toJSON()),
        total: subagents.length,
        filter: Object.keys(filter).length > 0 ? filter : null
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to list subagents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/subagents/categories
   * Get all available subagent categories
   */
  router.get('/categories', async (req: Request, res: Response) => {
    try {
      const categories = await subagentService.getCategories();

      res.json({
        categories,
        total: categories.length
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get categories',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/subagents/models
   * Get all Claude models used by subagents
   */
  router.get('/models', async (req: Request, res: Response) => {
    try {
      const models = await subagentService.getModels();

      res.json({
        models,
        total: models.length
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get models',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/subagents/search
   * Search subagents by query string
   *
   * Query params:
   * - q: Search query (required)
   * - category: Optional category filter
   * - limit: Maximum results (default: 50)
   */
  router.get('/search', async (req: Request, res: Response) => {
    try {
      const { q, category, limit } = req.query;

      if (!q) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Query parameter "q" is required'
        });
      }

      const results = await subagentService.search(
        q as string,
        category as string | undefined,
        limit ? parseInt(limit as string) : 50
      );

      res.json({
        results: results.map(s => s.toJSON()),
        total: results.length,
        query: q
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          error: 'Validation error',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to search subagents',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/subagents/:id
   * Get a specific subagent by ID
   */
  router.get('/:id(*)', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const subagent = await subagentService.getSubagent(id);

      res.json({
        subagent: subagent.toJSON()
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
        error: 'Failed to get subagent',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /v1/subagents/:id/stats
   * Get execution statistics for a subagent
   */
  router.get('/:id(*)/stats', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const stats = await subagentService.getStats(id);

      res.json({ stats });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * POST /v1/subagents/:id/execute
   * Record an execution of a subagent
   *
   * Body:
   * - success: boolean (required)
   * - inputTokens: number (required)
   * - outputTokens: number (required)
   */
  router.post('/:id(*)/execute', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { success, inputTokens, outputTokens } = req.body;

      if (typeof success !== 'boolean') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Field "success" is required and must be a boolean'
        });
      }

      if (typeof inputTokens !== 'number' || inputTokens < 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Field "inputTokens" is required and must be a non-negative number'
        });
      }

      if (typeof outputTokens !== 'number' || outputTokens < 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Field "outputTokens" is required and must be a non-negative number'
        });
      }

      await subagentService.recordExecution(id, success, inputTokens, outputTokens);

      res.json({
        success: true,
        message: 'Execution recorded'
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        return res.status(404).json({
          error: 'Not found',
          message: error.message
        });
      }

      res.status(500).json({
        error: 'Failed to record execution',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return router;
}
