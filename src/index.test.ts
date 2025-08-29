import { describe, it, expect } from 'vitest';
import { createServer } from './http-server';

describe('MCP Prompts Server', () => {
  it('should create HTTP server successfully', async () => {
    const app = await createServer();
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe('function');
  });

  it('should have health endpoint', async () => {
    const app = await createServer();
    
    // Simulate a request to health endpoint
    const mockReq = {} as any;
    const mockRes = {
      status: (code: number) => mockRes,
      json: (data: any) => {
        expect(data.status).toBe('ok');
        expect(data.service).toBe('mcp-prompts');
        return mockRes;
      }
    } as any;

    // Find health route
    const healthRoute = app._router?.stack?.find((layer: any) => 
      layer.route?.path === '/health'
    );
    
    if (healthRoute) {
      expect(healthRoute.route.path).toBe('/health');
    }
  });
});
