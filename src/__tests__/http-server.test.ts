import type { Server } from 'http';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mock } from 'jest-mock-extended';
import request from 'supertest';

import { startHttpServer } from '../http-server.js';
import type { Prompt } from '../interfaces.js';
import type { PromptService } from '../prompt-service.js';
import type { SequenceService } from '../sequence-service.js';
import type { WorkflowService } from '../workflow-service.js';

describe('HTTP Server', () => {
  let server: Server;
  let promptService: DeepMockProxy<PromptService>;
  let sequenceService: DeepMockProxy<SequenceService>;
  let workflowService: DeepMockProxy<WorkflowService>;

  beforeEach(async () => {
    process.env.API_KEYS = 'test-key';
    // Create mock services
    promptService = mock<PromptService>();
    sequenceService = mock<SequenceService>();
    workflowService = mock<WorkflowService>();

    // Start server
    server = await startHttpServer(
      null,
      {
        enableSSE: true,
        host: 'localhost',
        port: 0,
        ssePath: '/events',
      },
      { promptService, sequenceService, workflowService },
    );
  });

  afterEach(done => {
    server.close(done);
  });

  describe('Security Headers', () => {
    it('should set security headers', async () => {
      const response = await request(server).get('/health');
      expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('0');
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit requests', async () => {
      // Make 101 requests (default limit is 100)
      for (let i = 0; i < 100; i++) {
        await request(server).get('/health');
      }
      const response = await request(server).get('/health');
      expect(response.status).toBe(429);
    });
  });

  describe('CORS', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(server)
        .options('/health')
        .set('Origin', 'http://example.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(response.status).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe('*');
      expect(response.headers['access-control-allow-methods']).toBeDefined();
    });
  });

  describe('Prompt Endpoints', () => {
    it('should create a prompt', async () => {
      const prompt = {
        content: 'Hello, {{name}}!',
        isTemplate: true,
        name: 'Test Prompt',
        variables: ['name'],
      };

      promptService.createPrompt.mockResolvedValue({
        id: '123',
        ...prompt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      });

      const apiKey = 'test-key';
      const response = await request(server).post('/prompts').set('x-api-key', apiKey).send(prompt);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        id: '123',
        ...prompt,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
        version: 1,
      });
    });

    it('should handle missing required fields', async () => {
      const apiKey = 'test-key';
      const response = await request(server).post('/prompts').set('x-api-key', apiKey).send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
      expect(response.body.message).toBe('Invalid prompt data');
      expect(Array.isArray(response.body.details)).toBe(true);
      expect(response.body.details.length).toBeGreaterThan(0);
    });

    it('should get a prompt', async () => {
      const prompt = {
        content: 'Hello!',
        createdAt: new Date().toISOString(),
        id: '123',
        name: 'Test Prompt',
        updatedAt: new Date().toISOString(),
        version: 1,
      };

      promptService.getPrompt.mockResolvedValue(prompt);

      const apiKey = 'test-key';
      const response = await request(server).get('/prompts/123').set('x-api-key', apiKey);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject(prompt);
    });

    it('should handle not found prompt', async () => {
      promptService.getPrompt.mockResolvedValue(null);

      const apiKey = 'test-key';
      const response = await request(server).get('/prompts/123').set('x-api-key', apiKey);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors', async () => {
      promptService.getPrompt.mockRejectedValue(new Error('Database error'));

      const apiKey = 'test-key';
      const response = await request(server).get('/prompts/123').set('x-api-key', apiKey);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe(true);
      expect(response.body.code).toBe('INTERNAL_ERROR');
    });

    it('should handle 404 for unknown routes', async () => {
      const apiKey = 'test-key';
      const response = await request(server).get('/unknown').set('x-api-key', apiKey);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe(true);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  it('should return 404 for unknown routes', async () => {
    const apiKey = 'test-key';
    const res = await request(server).get('/unknown-route').set('x-api-key', apiKey);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: 'NOT_FOUND',
      error: true,
      message: 'Resource not found',
    });
  });
});
