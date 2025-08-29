import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pino } from 'pino';

// Use require for cors to avoid TypeScript declaration issues
const cors = require('cors');

const logger = pino({
  level: process.env.LOG_LEVEL || 'info'
});

export async function createServer(): Promise<express.Application> {
  const app = express();

  // Security middleware
  app.use(helmet());
  app.use(cors());
  
  // Rate limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use(limiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '3.0.6',
      service: 'mcp-prompts'
    });
  });

  // API documentation endpoint
  app.get('/api-docs', (req, res) => {
    res.json({
      name: 'MCP Prompts API',
      version: '3.0.6',
      description: 'API for managing prompts and templates',
      endpoints: {
        health: 'GET /health',
        apiDocs: 'GET /api-docs',
        prompts: 'GET /api/prompts',
        'prompts/:id': 'GET /api/prompts/:id',
        'prompts/:id/apply': 'POST /api/prompts/:id/apply'
      }
    });
  });

  // Basic prompts API
  app.get('/api/prompts', (req, res) => {
    res.json({
      message: 'Prompts endpoint - implementation coming soon',
      status: 'development'
    });
  });

  app.get('/api/prompts/:id', (req, res) => {
    res.json({
      message: `Prompt ${req.params.id} - implementation coming soon`,
      status: 'development'
    });
  });

  app.post('/api/prompts/:id/apply', (req, res) => {
    res.json({
      message: `Apply template for prompt ${req.params.id} - implementation coming soon`,
      status: 'development',
      variables: req.body
    });
  });

  // Error handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
  });

  // 404 handler
  app.use('*', (req, res) => {
    res.status(404).json({
      error: 'Not found',
      message: `Route ${req.originalUrl} not found`
    });
  });

  return app;
}
