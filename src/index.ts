#!/usr/bin/env node

import { DynamoDBAdapter } from './adapters/aws/dynamodb-adapter';
import { S3CatalogAdapter } from './adapters/aws/s3-adapter';
import { SQSAdapter } from './adapters/aws/sqs-adapter';
import { PromptService } from './core/services/prompt.service';
import { McpServer } from './mcp/mcp-server';
import { MetricsCollector } from './monitoring/cloudwatch-metrics';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

async function startServer() {
  try {
    console.log('Starting server...');
    const mode = process.env.MODE || 'mcp';
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    console.log('Mode:', mode, 'Port:', port, 'Host:', host);

    // Initialize AWS adapters
    const promptRepository = new DynamoDBAdapter(
      process.env.PROMPTS_TABLE || 'mcp-prompts'
    );
    const catalogRepository = new S3CatalogAdapter(
      process.env.PROMPTS_BUCKET || 'mcp-prompts-catalog'
    );
    const eventBus = new SQSAdapter(
      process.env.PROCESSING_QUEUE || 'mcp-prompts-processing'
    );
    const metricsCollector = new MetricsCollector();

    // Initialize services
    const promptService = new PromptService(
      promptRepository,
      catalogRepository,
      eventBus
    );
    const mcpServer = new McpServer(promptService);

    if (mode === 'mcp') {
      // Start MCP server
      console.log('Starting MCP server...');
      await mcpServer.start();
      console.log('MCP server started successfully');
      logger.info('MCP Prompts server started in MCP mode');
    } else if (mode === 'http') {
      // Start HTTP server
      const app = express();
      
      app.use(helmet());
      app.use(cors());
      app.use(express.json());

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
            services: {
              dynamodb: health[0],
              s3: health[1],
              sqs: health[2]
            },
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          logger.error('Health check failed:', error);
          res.status(503).json({
            status: 'unhealthy',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // MCP capabilities endpoint
      app.get('/mcp', (req, res) => {
        res.json(mcpServer.getCapabilities());
      });

      // MCP tools endpoint
      app.get('/mcp/tools', (req, res) => {
        res.json(mcpServer.getTools());
      });

      // Execute MCP tool
      app.post('/mcp/tools', async (req, res) => {
        try {
          const { tool, arguments: args } = req.body;
          const result = await mcpServer.executeTool(tool, args);
          res.json({ result });
        } catch (error) {
          logger.error('Tool execution failed:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Prompts API endpoints
      app.get('/v1/prompts', async (req, res) => {
        try {
          const { category, limit = '50' } = req.query;
          const prompts = category
            ? await promptService.getPromptsByCategory(category as string, parseInt(limit as string))
            : await promptService.getLatestPrompts(parseInt(limit as string));

          res.json({
            prompts: prompts.map(p => p.toJSON()),
            total: prompts.length
          });
        } catch (error) {
          logger.error('Failed to list prompts:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.get('/v1/prompts/:id', async (req, res) => {
        try {
          const prompt = await promptService.getPrompt(req.params.id);
          if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found' });
          }
          res.json({ prompt: prompt.toJSON() });
        } catch (error) {
          logger.error('Failed to get prompt:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
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
          logger.error('Failed to create prompt:', error);
          res.status(400).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.put('/v1/prompts/:id', async (req, res) => {
        try {
          const prompt = await promptService.updatePrompt(req.params.id, req.body);
          res.json({
            prompt: prompt.toJSON(),
            message: 'Prompt updated successfully'
          });
        } catch (error) {
          logger.error('Failed to update prompt:', error);
          res.status(400).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.delete('/v1/prompts/:id', async (req, res) => {
        try {
          await promptService.deletePrompt(req.params.id);
          res.json({ message: 'Prompt deleted successfully' });
        } catch (error) {
          logger.error('Failed to delete prompt:', error);
          res.status(400).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.post('/v1/prompts/:id/apply', async (req, res) => {
        try {
          const result = await promptService.applyTemplate(req.params.id, req.body.variables || {});
          res.json({
            result,
            appliedVariables: req.body.variables || {}
          });
        } catch (error) {
          logger.error('Failed to apply template:', error);
          res.status(400).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.listen(port, host, () => {
        logger.info(`MCP Prompts HTTP server started on http://${host}:${port}`);
        logger.info('Available endpoints:');
        logger.info('  GET  /health - Health check');
        logger.info('  GET  /mcp - MCP capabilities');
        logger.info('  GET  /mcp/tools - List MCP tools');
        logger.info('  POST /mcp/tools - Execute MCP tool');
        logger.info('  GET  /v1/prompts - List prompts');
        logger.info('  GET  /v1/prompts/:id - Get prompt');
        logger.info('  POST /v1/prompts - Create prompt');
        logger.info('  PUT  /v1/prompts/:id - Update prompt');
        logger.info('  DELETE /v1/prompts/:id - Delete prompt');
        logger.info('  POST /v1/prompts/:id/apply - Apply template variables');
      });
    }

  } catch (error) {
    logger.error('Failed to start server:', error);
    if (error instanceof Error) {
      logger.error('Error details:', error.message);
      logger.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  logger.error('Fatal error:', error);
  if (error instanceof Error) {
    logger.error('Fatal error details:', error.message);
    logger.error('Fatal error stack:', error.stack);
  }
  process.exit(1);
});
