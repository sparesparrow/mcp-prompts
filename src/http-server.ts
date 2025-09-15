import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { DynamoDBAdapter } from './adapters/aws/dynamodb-adapter';
import { S3CatalogAdapter } from './adapters/aws/s3-adapter';
import { SQSAdapter } from './adapters/aws/sqs-adapter';
import { PromptService } from './core/services/prompt.service';
import { McpServer } from './mcp/mcp-server';

export async function createServer(): Promise<express.Application> {
  const app = express();

  // Middleware
  app.use(helmet());
  app.use(cors());
  app.use(morgan('combined'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Initialize adapters (use environment variables or defaults)
  const promptRepository = new DynamoDBAdapter(
    process.env.PROMPTS_TABLE || 'mcp-prompts'
  );
  const catalogRepository = new S3CatalogAdapter(
    process.env.PROMPTS_BUCKET || 'mcp-prompts-catalog-bucket'
  );
  const eventBus = new SQSAdapter(
    process.env.PROCESSING_QUEUE || 'mcp-prompts-processing'
  );

  // Initialize services
  const promptService = new PromptService(promptRepository, catalogRepository, eventBus);
  const mcpServer = new McpServer(promptService);

  // Health check endpoint
  app.get('/health', async (req, res) => {
    try {
      const health = await Promise.all([
        promptRepository.healthCheck(),
        catalogRepository.healthCheck(),
        eventBus.healthCheck()
      ]);

      const allHealthy = health.every(h => h.status === 'healthy');

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'unhealthy',
        service: 'mcp-prompts',
        services: {
          dynamodb: health[0],
          s3: health[1],
          sqs: health[2]
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        service: 'mcp-prompts',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });

  // API routes
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

  app.post('/v1/prompts', async (req, res) => {
    try {
      const prompt = await promptService.createPrompt(req.body);
      res.status(201).json({
        prompt: prompt.toJSON(),
        message: 'Prompt created successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to create prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.put('/v1/prompts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const prompt = await promptService.updatePrompt(id, req.body);
      
      res.json({
        prompt: prompt.toJSON(),
        message: 'Prompt updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to update prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.delete('/v1/prompts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await promptService.deletePrompt(id);
      
      res.json({ message: 'Prompt deleted successfully' });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to delete prompt',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/v1/prompts/:id/apply', async (req, res) => {
    try {
      const { id } = req.params;
      const { variables } = req.body;
      
      const result = await promptService.applyTemplate(id, variables || {});
      
      res.json({
        result,
        appliedVariables: variables
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to apply template',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // MCP endpoints
  app.get('/mcp', (req, res) => {
    res.json(mcpServer.getCapabilities());
  });

  app.get('/mcp/tools', (req, res) => {
    res.json(mcpServer.getTools());
  });

  app.post('/mcp/tools', async (req, res) => {
    try {
      const { tool, arguments: args } = req.body;
      const result = await mcpServer.executeTool(tool, args);
      res.json({ result });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to execute tool',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Search endpoint
  app.get('/v1/search', async (req, res) => {
    try {
      const { q: query, category } = req.query;
      
      if (!query) {
        return res.status(400).json({ error: 'Query parameter is required' });
      }

      const prompts = await promptService.searchPrompts(query as string, category as string);
      
      res.json({
        prompts: prompts.map(p => p.toJSON()),
        total: prompts.length,
        query: query as string
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to search prompts',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message || 'Unknown error'
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return app;
}