import { logger } from './utils';

/**
 * Minimal HTTP server stub for MCP Prompts
 * Can be extended with Express or another framework
 */
export interface HttpServerApp {
  listen: (port: number | string, host?: string | (() => void), callback?: () => void) => any;
  _router?: any;
}

/**
 * Create and configure the HTTP server
 */
export async function createServer(): Promise<HttpServerApp> {
  const routes: Map<string, any> = new Map();

  // Register health endpoint
  routes.set('/health', {
    path: '/health',
    method: 'GET',
    handler: (req: any, res: any) => {
      res.json({
        status: 'ok',
        service: 'mcp-prompts',
        timestamp: new Date().toISOString(),
      });
    },
  });

  // Register readiness endpoint
  routes.set('/ready', {
    path: '/ready',
    method: 'GET',
    handler: (req: any, res: any) => {
      res.json({
        status: 'ready',
        service: 'mcp-prompts',
      });
    },
  });

  // Register version endpoint
  routes.set('/version', {
    path: '/version',
    method: 'GET',
    handler: (req: any, res: any) => {
      res.json({
        version: '4.0.0',
        service: 'mcp-prompts',
      });
    },
  });

  // Create a mock Express-like object for testing
  const app: HttpServerApp = {
    listen: (port: number | string, host?: string | (() => void), callback?: () => void) => {
      const cb = typeof host === 'function' ? host : callback;
      if (cb) cb();
      return app;
    },
    _router: {
      stack: Array.from(routes.values()).map((route: any) => ({
        route: route,
      })),
    },
  };

  return app;
}

/**
 * Start the HTTP server
 */
export async function startHttpServer(port: number = 3000, host: string = '0.0.0.0'): Promise<void> {
  const app = await createServer();

  app.listen(port, host, () => {
    logger.info(`MCP Prompts HTTP server listening on ${host}:${port}`);
  });
}

export default createServer;
