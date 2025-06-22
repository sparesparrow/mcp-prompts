import type { Server } from 'http';
import type { DeepMockProxy } from 'jest-mock-extended';
import { mock } from 'jest-mock-extended';
import request from 'supertest';
import { jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

import { closeServer } from '../../tests/setup.js';
import { AppError, HttpErrorCode } from '../errors.js';
import { errorHandler, startHttpServer } from '../http-server.js';
import type { Prompt } from '../interfaces.js';
import type { PromptService } from '../prompt-service.js';
import type { SequenceService } from '../sequence-service.js';
import type { WorkflowService } from '../workflow-service.js';

describe.skip('HTTP Server', () => {
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
      { promptService, sequenceService, storageAdapters: [], workflowService },
    );
  });

  afterEach(async () => {
    // Použijeme helper funkci místo callback
    await closeServer(server);
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
      // NOTE: The API requires id, version, createdAt, and updatedAt fields for prompt creation.
      const now = new Date().toISOString();
      const prompt = {
        content: 'Hello, {{name}}!',
        createdAt: now,
        id: 'test-prompt',
        isTemplate: true,
        name: 'Test Prompt',
        updatedAt: now,
        variables: ['name'],
        version: 1,
      };

      promptService.createPrompt.mockResolvedValue({ ...prompt });

      const apiKey = 'test-key';
      const response = await request(server).post('/prompts').set('x-api-key', apiKey).send(prompt);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        prompt,
        success: true,
      });
    });

    it('should handle missing required fields', async () => {
      const apiKey = 'test-key';
      const response = await request(server).post('/prompts').set('x-api-key', apiKey).send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.message).toBe('Invalid input data.');
      expect(Array.isArray(response.body.error.details)).toBe(true);
      expect(response.body.error.details.length).toBeGreaterThan(0);
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

      promptService.getPrompt.mockResolvedValue(prompt as Prompt);

      const apiKey = 'test-key';
      const response = await request(server).get('/prompts/123').set('x-api-key', apiKey);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        prompt,
        success: true,
      });
    });

    it('should handle not found prompt', async () => {
      promptService.getPrompt.mockResolvedValue(null);

      const apiKey = 'test-key';
      const response = await request(server).get('/prompts/123').set('x-api-key', apiKey);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('NOT_FOUND');
      expect(response.body.error.message).toBe('Prompt not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle internal server errors', async () => {
      promptService.getPrompt.mockRejectedValue(
        new AppError('Database error', 500, HttpErrorCode.INTERNAL_SERVER_ERROR),
      );

      const apiKey = 'test-key';
      const response = await request(server).get('/prompts/123').set('x-api-key', apiKey);

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.error.message).toBe('An unexpected internal server error occurred.');
    });

    it('should handle 404 for unknown routes', async () => {
      const apiKey = 'test-key';
      const response = await request(server).get('/unknown-route').set('x-api-key', apiKey);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
        success: false,
      });
    });
  });

  it('should return 404 for unknown routes', async () => {
    const apiKey = 'test-key';
    const res = await request(server).get('/unknown-route').set('x-api-key', apiKey);
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
      },
      success: false,
    });
  });
});

describe('errorHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  // ... existing code ...
});

export { HttpErrorCode };
