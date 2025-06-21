import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';

import { MemoryAdapter } from '../../src/adapters.js';
import { startHttpServer } from '../../src/http-server.js';
import { PromptService } from '../../src/prompt-service.js';
import type { SequenceService } from '../../src/sequence-service.js';
import { WorkflowServiceImpl as WorkflowService } from '../../src/workflow-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server: any;
let baseUrl: string;
let promptService: PromptService;
let adapter: MemoryAdapter;

const SAMPLE_WORKFLOW_PATH = path.resolve(process.cwd(), 'examples', 'sample-workflow.json');

class DummySequenceService {
  public async getSequenceWithPrompts(id: string) {
    return { id, prompts: [] };
  }
}

beforeAll(async () => {
  process.env.API_KEYS = 'test-key';
  adapter = new MemoryAdapter();
  await adapter.connect();
  promptService = new PromptService(adapter);
  const sequenceService = new DummySequenceService() as unknown as SequenceService;
  const workflowService = new WorkflowService(adapter, promptService);
  server = await startHttpServer(
    null,
    { host: '122.0.0.1', port: 0 },
    { promptService, sequenceService, workflowService, storageAdapters: [adapter] },
  );
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server && server.close) await server.close();
});

describe('HTTP Server Integration', () => {
  beforeEach(async () => {
    await adapter.clearAll();
  });

  it('should return health status', async () => {
    const res = await request(baseUrl).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('should create and retrieve a prompt', async () => {
    const promptData = {
      name: 'HTTP Test',
      content: 'Hello, HTTP!',
    };
    const createRes = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(promptData);

    expect(createRes.status).toBe(201);
    const createdPrompt = createRes.body.prompt;
    expect(createdPrompt.id).toBeDefined();
    expect(createdPrompt.version).toBe(1);
    expect(createdPrompt.name).toBe(promptData.name);

    const getRes = await request(baseUrl)
      .get(`/prompts/${createdPrompt.id}?version=${createdPrompt.version}`)
      .set('x-api-key', 'test-key');
    expect(getRes.status).toBe(200);
    expect(getRes.body.prompt).toBeDefined();
    expect(getRes.body.prompt.id).toBe(createdPrompt.id);
  });

  it('should update a prompt', async () => {
    const promptData = {
      name: 'Update HTTP',
      content: 'Update me',
    };
    const createRes = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(promptData);
    expect(createRes.status).toBe(201);
    const createdPrompt = createRes.body.prompt;

    const updatePayload = {
      content: 'Updated content',
    };

    const updateRes = await request(baseUrl)
      .put(`/prompts/${createdPrompt.id}/${createdPrompt.version}`)
      .set('x-api-key', 'test-key')
      .send(updatePayload);

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.prompt.content).toBe('Updated content');
    expect(updateRes.body.prompt.version).toBe(2);
  });

  it('should delete a prompt', async () => {
    const promptData = {
      name: 'Delete HTTP',
      content: 'Delete me',
    };
    const createRes = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(promptData);
    expect(createRes.status).toBe(201);
    const createdPrompt = createRes.body.prompt;

    const deleteRes = await request(baseUrl)
      .delete(`/prompts/${createdPrompt.id}/${createdPrompt.version}`)
      .set('x-api-key', 'test-key');
    expect([200, 204]).toContain(deleteRes.status);

    const getRes = await request(baseUrl)
      .get(`/prompts/${createdPrompt.id}`)
      .set('x-api-key', 'test-key');
    expect(getRes.status).toBe(404);
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(baseUrl).get('/unknown').set('x-api-key', 'test-key');
    expect(res.status).toBe(404);
  });

  it('should return 400 for invalid prompt creation', async () => {
    const res = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({ content: '', name: '' });
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing required fields', async () => {
    const cases = [{}, { name: 'No Content' }, { content: 'No Name' }, { name: '', content: '' }];
    for (const body of cases) {
      const res = await request(baseUrl)
        .post('/prompts')
        .set('x-api-key', 'test-key')
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('should return 400 for invalid field types', async () => {
    const cases = [
      { name: 'Bad Version', content: 'test', version: 'not-a-number' },
      { name: 'Bad createdAt', content: 'test', createdAt: 123 },
      { name: 'Bad updatedAt', content: 'test', updatedAt: false },
    ];
    for (const body of cases) {
      const res = await request(baseUrl)
        .post('/prompts')
        .set('x-api-key', 'test-key')
        .send(body);
      expect(res.status).toBe(400);
    }
  });

  it('should return 400 for whitespace-only content', async () => {
    const res = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({ name: 'Whitespace', content: '   ' });
    expect(res.status).toBe(400);
  });

  it('should return 409 for duplicate prompt name', async () => {
    const prompt = {
      name: 'Dup HTTP',
      content: 'Dup content',
    };
    const res1 = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    expect(res1.status).toBe(201);
    const res2 = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    expect(res2.status).toBe(409);
    expect(res2.body.error.message).toMatch(/already exists/);
  });

  it('should return 400 for template variable mismatches', async () => {
    let res = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({
        name: 'VarMismatch1',
        content: 'Hello {{foo}}',
        isTemplate: true,
        variables: [],
      });
    expect(res.status).toBe(400);
    res = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({
        name: 'VarMismatch2',
        content: 'Hello',
        isTemplate: true,
        variables: ['foo'],
      });
    expect(res.status).toBe(400);
  });
});

describe('Prompt List (GET /prompts)', () => {
  beforeEach(async () => {
    await adapter.clearAll();
    const now = new Date().toISOString();
    const prompts = [
      { name: 'A', content: 'A', tags: ['a', 'test'], category: 'general' },
      { name: 'B', content: 'B', tags: ['b', 'test'], category: 'general' },
      { name: 'C', content: 'C', tags: ['c'], category: 'other' },
      { name: 'Find Me', content: 'The word is test' },
    ];
    for (const p of prompts) {
      await promptService.createPrompt({
        version: 1,
        isTemplate: false,
        createdAt: now,
        updatedAt: now,
        ...p,
      });
    }
  });

  it('should list all prompts', async () => {
    const res = await request(baseUrl).get('/prompts').set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prompts)).toBe(true);
    expect(res.body.total).toBe(4);
  });

  it('should paginate results', async () => {
    const res1 = await request(baseUrl)
      .get('/prompts?offset=0&limit=1')
      .set('x-api-key', 'test-key');
    const res2 = await request(baseUrl)
      .get('/prompts?offset=1&limit=1')
      .set('x-api-key', 'test-key');
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.prompts.length).toBe(1);
    expect(res2.body.prompts.length).toBe(1);
    expect(res1.body.prompts[0].id).not.toBe(res2.body.prompts[0].id);
  });

  it('should sort by name ascending', async () => {
    const res = await request(baseUrl).get('/prompts?sort=name&order=asc').set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    const names = res.body.prompts.map((p: any) => p.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('should filter by tag', async () => {
    const res = await request(baseUrl).get('/prompts?tags=test').set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(res.body.prompts.length).toBe(2);
    for (const prompt of res.body.prompts) {
      expect(prompt.tags).toContain('test');
    }
  });

  it('should filter by category', async () => {
    const res = await request(baseUrl).get('/prompts?category=general').set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(res.body.prompts.length).toBe(2);
    for (const prompt of res.body.prompts) {
      expect(prompt.category).toBe('general');
    }
  });

  it('should filter by isTemplate', async () => {
    await promptService.createPrompt({
      name: 'Template',
      content: 'a template',
      isTemplate: true,
      version: 1,
    });
    const res = await request(baseUrl)
      .get('/prompts?isTemplate=true')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(res.body.prompts.length).toBe(1);
    expect(res.body.prompts[0].isTemplate).toBe(true);
  });

  it('should search by name/content/description', async () => {
    const res = await request(baseUrl).get('/prompts?search=test').set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(res.body.prompts.length).toBe(1);
    expect(res.body.prompts[0].name).toBe('Find Me');
  });

  it('should combine filters', async () => {
    const res = await request(baseUrl)
      .get('/prompts?tags=test&category=general')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(res.body.prompts.length).toBe(2);
  });
});

describe('Bulk Prompt Operations', () => {
  let dupPrompt: any;
  beforeEach(async () => {
    await adapter.clearAll();
    dupPrompt = {
      name: 'Bulk Dup',
      content: 'I will be duplicated',
      version: 1,
    };
    await promptService.createPrompt(dupPrompt);
  });

  it('should bulk create prompts successfully, skipping duplicates', async () => {
    const prompts = [
      dupPrompt,
      { name: 'New 1', content: 'content' },
      { name: '', content: '' },
      { name: 'New 2', content: 'content' },
    ];
    const res = await request(baseUrl)
      .post('/prompts/bulk')
      .set('x-api-key', 'test-key')
      .send(prompts);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(4);
    expect(res.body[0].success).toBe(false);
    expect(res.body[0].error).toMatch(/already exists/);
    expect(res.body[1].success).toBe(true);
    expect(res.body[2].success).toBe(false);
    expect(res.body[3].success).toBe(true);
  });

  it('should bulk delete prompts and return per-id results', async () => {
    const res = await request(baseUrl)
      .post('/prompts/bulk-delete')
      .set('x-api-key', 'test-key')
      .send({ ids: ['bulk-dup', 'non-existent'] });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.find((r: any) => r.id === 'bulk-dup').success).toBe(true);
    expect(res.body.find((r: any) => r.id === 'non-existent').success).toBe(false);
  });

  it('should return all errors for bulk delete with all non-existent IDs', async () => {
    const res = await request(baseUrl)
      .post('/prompts/bulk-delete')
      .set('x-api-key', 'test-key')
      .send({ ids: ['a', 'b', 'c'] });
    expect(res.status).toBe(200);
    expect(res.body.every((r: any) => !r.success)).toBe(true);
  });
});

describe('Workflow Engine Integration', () => {
  let sampleWorkflow: any;
  beforeAll(() => {
    sampleWorkflow = JSON.parse(fs.readFileSync(SAMPLE_WORKFLOW_PATH, 'utf8'));
  });

  beforeEach(async () => {
    await adapter.clearAll();
    await promptService.createPrompt({
      name: 'Test Prompt',
      content: 'The capital of {{country}} is',
      isTemplate: true,
      variables: ['country'],
      version: 1,
    });
  });

  it('should save and run a sample workflow', async () => {
    let saveRes = await request(baseUrl)
      .post('/api/v1/workflows')
      .set('x-api-key', 'test-key')
      .send(sampleWorkflow);
    expect([200, 201]).toContain(saveRes.status);

    const runRes = await request(baseUrl)
      .post(`/api/v1/workflows/${sampleWorkflow.id}/run`)
      .set('x-api-key', 'test-key')
      .send({
        state: {
          parameters: {
            country: 'France',
          },
        },
      });
    expect(runRes.status).toBe(200);
    expect(runRes.body).toHaveProperty('state');
    expect(runRes.body.state.outputs).toHaveProperty('capital');
    expect(runRes.body.state.outputs.capital).toMatch(/Paris/);
  });

  it('should enforce workflow rate limiting', async () => {
    let saveRes = await request(baseUrl)
      .post('/api/v1/workflows')
      .set('x-api-key', 'test-key')
      .send(sampleWorkflow);
    expect([200, 201]).toContain(saveRes.status);

    const workflowServiceWithRateLimit = new WorkflowService(adapter, promptService);

    const runPromise = workflowServiceWithRateLimit.runWorkflow(
      sampleWorkflow.id,
      { userId: 'ratelimit-test' },
    );
    const runPromise2 = workflowServiceWithRateLimit.runWorkflow(
      sampleWorkflow.id,
      { userId: 'ratelimit-test' },
    );
    await expect(Promise.all([runPromise, runPromise2])).rejects.toThrow(/Rate limit exceeded/);
  });
});

function makePromptPayload(overrides: Partial<Record<string, any>> = {}) {
  const now = new Date().toISOString();
  return {
    id: `prompt-${Math.random().toString(36).slice(2, 10)}`,
    name: 'Test Prompt',
    content: 'Test content',
    isTemplate: false,
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
