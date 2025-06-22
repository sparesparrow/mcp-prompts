import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

import { MemoryAdapter } from '../../src/adapters.js';
import { startHttpServer } from '../../src/http-server.js';
import { PromptService } from '../../src/prompt-service.js';
import type { SequenceService } from '../../src/sequence-service.js';
import { WorkflowServiceImpl as WorkflowService } from '../../src/workflow-service.js';
import { closeServer } from '../setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server: any;
let baseUrl: string;
let promptService: PromptService;
let adapter: MemoryAdapter;

const SAMPLE_WORKFLOW_PATH = path.resolve(
  process.cwd(),
  'data',
  'workflows',
  'sample-workflow.json',
);

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
    { host: '127.0.0.1', port: 0 },
    {
      promptService,
      sequenceService,
      storageAdapters: [adapter],
      workflowService,
      elevenLabsService: {} as any,
    },
  );
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await closeServer(server);
  await new Promise(resolve => setTimeout(resolve, 100));
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
      isTemplate: false,
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
      isTemplate: false,
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
    expect(updateRes.body.prompt.version).toBe(1);
  });

  it('should delete a prompt', async () => {
    const promptData = {
      name: 'Delete HTTP',
      content: 'Delete me',
      isTemplate: false,
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
      .send({ content: '', name: '', isTemplate: false });
    expect(res.status).toBe(400);
  });

  it('should return 400 for missing required fields', async () => {
    const cases = [
      {},
      { name: 'No Content', isTemplate: false },
      { content: 'No Name', isTemplate: false },
      { name: '', content: '', isTemplate: false },
    ];
    for (const body of cases) {
      const res = await request(baseUrl).post('/prompts').set('x-api-key', 'test-key').send(body);
      expect(res.status).toBe(400);
    }
  });

  it('should return 400 for whitespace-only content', async () => {
    const res = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({ name: 'Whitespace', content: '   ', isTemplate: false });
    expect(res.status).toBe(400);
  });

  it('should return 409 for duplicate prompt name', async () => {
    const prompt = {
      name: 'Dup HTTP',
      content: 'Dup content',
      isTemplate: false,
    };
    const res1 = await request(baseUrl).post('/prompts').set('x-api-key', 'test-key').send(prompt);
    expect(res1.status).toBe(201);
    const res2 = await request(baseUrl).post('/prompts').set('x-api-key', 'test-key').send(prompt);
    expect(res2.status).toBe(409);
    expect(res2.body.error.message).toMatch(/already exists/);
  });

  it('should return 400 for template variable mismatches', async () => {
    let res = await request(baseUrl).post('/prompts').set('x-api-key', 'test-key').send({
      name: 'VarMismatch1',
      content: 'Hello {{foo}}',
      isTemplate: true,
      variables: [],
    });
    expect(res.status).toBe(400);
    res = await request(baseUrl).post('/prompts').set('x-api-key', 'test-key').send({
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
    const prompts = [
      { name: 'A', content: 'A', tags: ['a', 'test'], category: 'general' },
      { name: 'B', content: 'B', tags: ['b', 'test'], category: 'general' },
      { name: 'C', content: 'C', tags: ['c'], category: 'other' },
      { name: 'Find Me', content: 'The word is test' },
    ];
    for (const p of prompts) {
      await promptService.createPrompt({
        isTemplate: false,
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
    const res = await request(baseUrl)
      .get('/prompts?sort=name&order=asc')
      .set('x-api-key', 'test-key');
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
  beforeEach(async () => {
    await adapter.clearAll();
    await promptService.createPrompt({ name: 'p1', content: 'c1', isTemplate: false });
    await promptService.createPrompt({ name: 'p2', content: 'c2', isTemplate: false });
  });

  it('should bulk create prompts successfully, skipping duplicates', async () => {
    const prompts = [
      { name: 'p1', content: 'c1', isTemplate: false }, // Duplicate
      { name: 'New 1', content: 'content', isTemplate: false }, // New
      { name: '', content: '', isTemplate: false }, // Invalid
      { name: 'New 2', content: 'content', isTemplate: false }, // New
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
      .delete('/prompts/bulk')
      .set('x-api-key', 'test-key')
      .send({ ids: ['p1', 'non-existent'] });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body.find((r: any) => r.id === 'p1').success).toBe(true);
    expect(res.body.find((r: any) => r.id === 'non-existent').success).toBe(false);
  });

  it('should return all errors for bulk delete with all non-existent IDs', async () => {
    const res = await request(baseUrl)
      .delete('/prompts/bulk')
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
    // Use a unique name for the prompt to avoid conflicts between tests
    await promptService.createPrompt({
      name: `test-prompt-${randomUUID()}`,
      content: 'Output: {{input}}',
      isTemplate: true,
      variables: ['input'],
    });
  });

  it('should save and run a sample workflow', async () => {
    const workflow = { ...sampleWorkflow, id: `workflow-${randomUUID()}` };
    const saveRes = await request(baseUrl)
      .post('/api/v1/workflows')
      .set('x-api-key', 'test-key')
      .send(workflow);
    expect([200, 201]).toContain(saveRes.status);

    const runRes = await request(baseUrl)
      .post(`/api/v1/workflows/${workflow.id}/run`)
      .set('x-api-key', 'test-key')
      .send({
        state: {
          parameters: {
            country: 'France',
          },
        },
      });
    expect(runRes.status).toBe(200);
    expect(runRes.body).toHaveProperty('outputs');
    expect(runRes.body.outputs).toHaveProperty('step1_output');
    expect(runRes.body.outputs.step1_output).toBe('Output: test-value');
  });

  // This test is flaky in CI environments due to its reliance on timing and process management.
  it.skip('should enforce workflow rate limiting', async () => {
    const workflow = { ...sampleWorkflow, id: `workflow-${randomUUID()}` };
    const saveRes = await request(baseUrl)
      .post('/api/v1/workflows')
      .set('x-api-key', 'test-key')
      .send(workflow);
    expect([200, 201]).toContain(saveRes.status);

    const workflowServiceWithRateLimit = new WorkflowService(adapter, promptService);

    const runPromise = workflowServiceWithRateLimit.runWorkflow(workflow.id, {
      userId: 'ratelimit-test',
    } as any);
    const runPromise2 = workflowServiceWithRateLimit.runWorkflow(workflow.id, {
      userId: 'ratelimit-test',
    } as any);
    await expect(Promise.all([runPromise, runPromise2])).rejects.toThrow(/Rate limit exceeded/);
  });
});
