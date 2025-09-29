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
import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from '@aws-sdk/client-dynamodb';
import { PaymentService } from './core/services/payment.service';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true
    }
  } : undefined
});

// Initialize DynamoDB client for user data
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Middleware to extract user context from Authorization header
async function extractUserContext(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      // In a real implementation, you'd validate the JWT token here
      // For now, we'll assume the token contains user info or extract from Cognito

      // Extract user info from request (this would be done by API Gateway Cognito authorizer)
      const userId = req.headers['x-user-id'] as string;
      const userEmail = req.headers['x-user-email'] as string;

      if (userId) {
        // Get user subscription info from DynamoDB
        const userResult = await dynamoClient.send(new GetItemCommand({
          TableName: process.env.USERS_TABLE!,
          Key: { user_id: { S: userId } }
        }));

        if (userResult.Item) {
          (req as any).userContext = {
            userId,
            email: userEmail,
            subscriptionTier: userResult.Item.subscription_tier?.S || 'free'
          };
        }
      }
    }

    next();
  } catch (error) {
    logger.error('Error extracting user context:', error);
    next();
  }
}

// Rate limiting middleware (will be defined after services are initialized)
function rateLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  // Implementation will be added after promptService is initialized
  next();
}

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
    const paymentService = new PaymentService();
    const mcpServer = new McpServer(promptService, promptRepository);

    // Update rate limiting function with service reference
    const actualRateLimit = function(req: express.Request, res: express.Response, next: express.NextFunction) {
      const userContext = (req as any).userContext;
      const clientId = userContext?.userId || req.ip || 'anonymous';

      const limits = promptService.getRateLimit(userContext);
      const now = Date.now();
      const windowStart = Math.floor(now / limits.windowMs) * limits.windowMs;

      const key = `${clientId}:${windowStart}`;
      const current = rateLimitStore.get(key) || { count: 0, resetTime: windowStart + limits.windowMs };

      if (now > current.resetTime) {
        current.count = 0;
        current.resetTime = windowStart + limits.windowMs;
      }

      current.count++;
      rateLimitStore.set(key, current);

      // Clean up old entries periodically
      if (Math.random() < 0.01) { // 1% chance to clean up
        for (const [k, v] of rateLimitStore.entries()) {
          if (now > v.resetTime) {
            rateLimitStore.delete(k);
          }
        }
      }

      res.set({
        'X-RateLimit-Limit': limits.requests.toString(),
        'X-RateLimit-Remaining': Math.max(0, limits.requests - current.count).toString(),
        'X-RateLimit-Reset': new Date(current.resetTime).toISOString()
      });

      if (current.count > limits.requests) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((current.resetTime - now) / 1000)
        });
      }

      next();
    };

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

      // Serve static files
      app.use(express.static('public'));

      // Apply middleware
      app.use(extractUserContext);
      app.use(actualRateLimit);

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
          const userContext = (req as any).userContext;

          const prompts = category
            ? await promptService.getPromptsByCategory(category as string, parseInt(limit as string))
            : await promptService.getLatestPrompts(parseInt(limit as string), userContext);

          // Filter prompts based on access control
          const accessiblePrompts = prompts.filter(p => promptService.hasAccessToPrompt(p, userContext));

          res.json({
            prompts: accessiblePrompts.map(p => p.toJSON()),
            total: accessiblePrompts.length,
            userTier: userContext?.subscriptionTier || 'anonymous'
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
          const userContext = (req as any).userContext;

          if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found' });
          }

          // Check access control
          if (!promptService.hasAccessToPrompt(prompt, userContext)) {
            return res.status(403).json({ error: 'Access denied to this prompt' });
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
          const userContext = (req as any).userContext;

          // Check if user can create prompts
          if (!userContext || !promptService.canCreatePrompt(userContext)) {
            return res.status(403).json({
              error: 'Prompt creation requires a premium subscription'
            });
          }

          // Add author information to the prompt
          const promptData = {
            ...req.body,
            author_id: userContext.userId,
            access_level: userContext.subscriptionTier === 'premium' ? 'premium' : 'private'
          };

          const prompt = await promptService.createPrompt(promptData);
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

      // Slash commands endpoints
      app.get('/v1/slash-commands', async (req, res) => {
        try {
          const userContext = (req as any).userContext;
          const { category, limit = '20' } = req.query;

          const slashCommandsService = new (await import('./core/services/slash-commands.service')).SlashCommandsService(promptRepository);
          const commands = category
            ? await slashCommandsService.getCommandsByCategory(category as string, userContext)
            : await slashCommandsService.getAvailableCommands(userContext);

          res.json({
            commands: commands.slice(0, parseInt(limit as string)),
            total: commands.length
          });
        } catch (error) {
          logger.error('Failed to list slash commands:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.get('/v1/slash-commands/suggest', async (req, res) => {
        try {
          const userContext = (req as any).userContext;
          const { q: query, limit = '10' } = req.query;

          if (!query || typeof query !== 'string') {
            return res.status(400).json({ error: 'Query parameter is required' });
          }

          const slashCommandsService = new (await import('./core/services/slash-commands.service')).SlashCommandsService(promptRepository);
          const suggestions = await slashCommandsService.getCommandSuggestions(query, userContext);

          res.json({
            suggestions: suggestions.slice(0, parseInt(limit as string)),
            total: suggestions.length
          });
        } catch (error) {
          logger.error('Failed to get slash command suggestions:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.post('/v1/slash-commands/execute', async (req, res) => {
        try {
          const userContext = (req as any).userContext;
          const { command, variables = {} } = req.body;

          if (!command || typeof command !== 'string') {
            return res.status(400).json({ error: 'Command is required' });
          }

          const slashCommandsService = new (await import('./core/services/slash-commands.service')).SlashCommandsService(promptRepository);
          const result = await slashCommandsService.executeCommand(command, variables, userContext);

          res.json(result);
        } catch (error) {
          logger.error('Failed to execute slash command:', error);
          res.status(400).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      // Payment endpoints
      app.get('/v1/subscription/plans', async (req, res) => {
        try {
          const plans = paymentService.getPlans();
          res.json({ plans });
        } catch (error) {
          logger.error('Failed to get subscription plans:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.post('/v1/payment/create-intent', async (req, res) => {
        try {
          const userContext = (req as any).userContext;
          const { amount, currency = 'usd', planId } = req.body;

          if (!userContext) {
            return res.status(401).json({ error: 'Authentication required' });
          }

          if (!amount || amount <= 0) {
            return res.status(400).json({ error: 'Valid amount is required' });
          }

          const paymentIntent = await paymentService.createPaymentIntent(amount, currency);

          res.json(paymentIntent);
        } catch (error) {
          logger.error('Failed to create payment intent:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.post('/v1/subscription/create', async (req, res) => {
        try {
          const userContext = (req as any).userContext;
          const { planId, paymentMethodId } = req.body;

          if (!userContext) {
            return res.status(401).json({ error: 'Authentication required' });
          }

          if (!planId) {
            return res.status(400).json({ error: 'Plan ID is required' });
          }

          const subscription = await paymentService.createSubscription(
            userContext.userId,
            userContext.email,
            planId,
            paymentMethodId
          );

          // Update user subscription in database
          await dynamoClient.send(new UpdateItemCommand({
            TableName: process.env.USERS_TABLE!,
            Key: { user_id: { S: userContext.userId } },
            UpdateExpression: 'SET subscription_tier = :tier, subscription_id = :subId, subscription_expires_at = :expires, updated_at = :updated',
            ExpressionAttributeValues: {
              ':tier': { S: planId.startsWith('premium') ? 'premium' : 'free' },
              ':subId': { S: subscription.subscriptionId },
              ':expires': { S: subscription.currentPeriodEnd.toISOString() },
              ':updated': { S: new Date().toISOString() }
            }
          }));

          res.json(subscription);
        } catch (error) {
          logger.error('Failed to create subscription:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.post('/v1/subscription/cancel', async (req, res) => {
        try {
          const userContext = (req as any).userContext;
          const { subscriptionId, cancelAtPeriodEnd = true } = req.body;

          if (!userContext) {
            return res.status(401).json({ error: 'Authentication required' });
          }

          await paymentService.cancelSubscription(subscriptionId, cancelAtPeriodEnd);

          // Update user subscription in database
          await dynamoClient.send(new UpdateItemCommand({
            TableName: process.env.USERS_TABLE!,
            Key: { user_id: { S: userContext.userId } },
            UpdateExpression: 'SET subscription_tier = :tier, updated_at = :updated',
            ExpressionAttributeValues: {
              ':tier': { S: 'free' },
              ':updated': { S: new Date().toISOString() }
            }
          }));

          res.json({ message: 'Subscription cancelled successfully' });
        } catch (error) {
          logger.error('Failed to cancel subscription:', error);
          res.status(500).json({
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      app.post('/v1/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
        try {
          const signature = req.headers['stripe-signature'] as string;
          await paymentService.handleWebhook(req.body, signature);
          res.json({ received: true });
        } catch (error) {
          logger.error('Webhook processing failed:', error);
          res.status(400).json({
            error: error instanceof Error ? error.message : 'Webhook processing failed'
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
        logger.info('  GET  /v1/slash-commands - List slash commands');
        logger.info('  GET  /v1/slash-commands/suggest - Get command suggestions');
        logger.info('  POST /v1/slash-commands/execute - Execute slash command');
        logger.info('  GET  /v1/subscription/plans - Get subscription plans');
        logger.info('  GET  /v1/subscription/status - Get subscription status');
        logger.info('  POST /v1/payment/create-intent - Create payment intent');
        logger.info('  POST /v1/subscription/create - Create subscription');
        logger.info('  POST /v1/subscription/cancel - Cancel subscription');
        logger.info('  POST /webhooks/stripe - Stripe webhooks');
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
