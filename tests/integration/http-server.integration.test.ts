import request from 'supertest';

import { MemoryAdapter } from '../../src/adapters.js';
import { startHttpServer } from '../../src/http-server.js';
import { PromptService } from '../../src/prompt-service.js';
import type { SequenceService } from '../../src/sequence-service.js';

let server: any;
let baseUrl: string;

class DummySequenceService {
  async getSequenceWithPrompts(id: string) {
    return { id, prompts: [] };
  }
}

beforeAll(async () => {
  const adapter = new MemoryAdapter();
  await adapter.connect();
  const promptService = new PromptService(adapter);
  const sequenceService = new DummySequenceService() as unknown as SequenceService;
  server = await startHttpServer(
    undefined,
    { host: '127.0.0.1', port: 0 },
    { promptService, sequenceService },
  );
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server && server.close) await server.close();
});

describe('HTTP Server Integration', () => {
  it('should return health status', async () => {
    const res = await request(baseUrl).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should create and retrieve a prompt', async () => {
    const prompt = {
      content: 'Hello, HTTP!',
      isTemplate: false,
      name: 'HTTP Test',
    };
    const createRes = await request(baseUrl).post('/prompts').send(prompt);
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('HTTP Test');
    const id = createRes.body.id;
    const getRes = await request(baseUrl).get(`/prompts/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('HTTP Test');
  });

  it('should update a prompt', async () => {
    const prompt = {
      content: 'Update me',
      isTemplate: false,
      name: 'Update HTTP',
    };
    const createRes = await request(baseUrl).post('/prompts').send(prompt);
    const id = createRes.body.id;
    const updateRes = await request(baseUrl).put(`/prompts/${id}`).send({ description: 'Updated' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.description).toBe('Updated');
  });

  it('should delete a prompt', async () => {
    const prompt = {
      content: 'Delete me',
      isTemplate: false,
      name: 'Delete HTTP',
    };
    const createRes = await request(baseUrl).post('/prompts').send(prompt);
    const id = createRes.body.id;
    const deleteRes = await request(baseUrl).delete(`/prompts/${id}`);
    expect(deleteRes.status).toBe(204);
    const getRes = await request(baseUrl).get(`/prompts/${id}`);
    expect(getRes.status).toBe(404);
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(baseUrl).get('/unknown');
    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid prompt creation', async () => {
    const res = await request(baseUrl).post('/prompts').send({ content: '', name: '' });
    expect(res.status).toBe(400);
  });
});
