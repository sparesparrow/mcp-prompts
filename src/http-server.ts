import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import express from 'express';
import cors from 'cors';
import { setupSSE } from './sse.js';
import { PromptService } from './prompt-service.js';
import { SequenceService } from './sequence-service.js';

export interface HttpServerConfig {
  port: number;
  host: string;
  corsOrigin?: string;
  enableSSE?: boolean;
  ssePath?: string;
}

export interface ServerServices {
  promptService: PromptService;
  sequenceService: SequenceService;
}

export async function startHttpServer(
  server: Server | null = null,
  config: HttpServerConfig,
  services: ServerServices
): Promise<void> {
  const app = express();

  // Enable CORS
  app.use(cors({
    origin: config.corsOrigin || '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  // Handle preflight requests
  app.options('*', (req, res) => {
    res.status(204).end();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/v1/sequence/:id', async (req, res) => {
    const { id } = req.params;
    try {
      const result = await services.sequenceService.getSequenceWithPrompts(id);
      res.json(result);
    } catch (error: any) {
      res.status(404).json({ error: error.message });
    }
  });

  // Set up SSE if enabled
  if (config.enableSSE) {
    setupSSE(app, config.ssePath || '/events');
  }

  // Start the server
  await new Promise<void>((resolve, reject) => {
    try {
      const httpServer = app.listen(config.port, config.host, () => {
        console.log(`HTTP server listening at http://${config.host}:${config.port}`);
        resolve();
      });

      httpServer.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
} 