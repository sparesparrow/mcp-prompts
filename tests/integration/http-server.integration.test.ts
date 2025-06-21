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

const SAMPLE_WORKFLOW_PATH = path.resolve(process.cwd(), 'examples', 'sample-workflow.json');

class DummySequenceService {
  public async getSequenceWithPrompts(id: string) {
    return { id, prompts: [] };
  }
}

beforeAll(async () => {
  process.env.API_KEYS = 'test-key';
  const adapter = new MemoryAdapter();
  await adapter.connect();
  const promptService = new PromptService(adapter);
  const sequenceService = new DummySequenceService() as unknown as SequenceService;
  const workflowService = new WorkflowService();
  server = await startHttpServer(
    undefined,
    { host: '127.0.0.1', port: 0 },
    { promptService, sequenceService, workflowService },
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
    const createRes = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('HTTP Test');
    const id = createRes.body.id;
    const getRes = await request(baseUrl)
      .get(`/prompts/${id}`)
      .set('x-api-key', 'test-key');
    expect(getRes.status).toBe(200);
    expect(getRes.body.name).toBe('HTTP Test');
  });

  it('should update a prompt', async () => {
    const prompt = {
      content: 'Update me',
      isTemplate: false,
      name: 'Update HTTP',
    };
    const createRes = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    const id = createRes.body.id;
    const updateRes = await request(baseUrl)
      .put(`/prompts/${id}`)
      .set('x-api-key', 'test-key')
      .send({ description: 'Updated' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.description).toBe('Updated');
  });

  it('should delete a prompt', async () => {
    const prompt = {
      content: 'Delete me',
      isTemplate: false,
      name: 'Delete HTTP',
    };
    const createRes = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    const id = createRes.body.id;
    const deleteRes = await request(baseUrl)
      .delete(`/prompts/${id}`)
      .set('x-api-key', 'test-key');
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);
    expect(deleteRes.body.id).toBe(id);
    expect(deleteRes.body.message).toBe('Prompt deleted.');
    const getRes = await request(baseUrl)
      .get(`/prompts/${id}`)
      .set('x-api-key', 'test-key');
    expect(getRes.status).toBe(404);
    expect(getRes.body.success).toBe(false);
    expect(getRes.body.error.code).toBe('NOT_FOUND');
    expect(getRes.body.error.message).toBe('Prompt not found.');
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(baseUrl)
      .get('/unknown')
      .set('x-api-key', 'test-key');
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

  it('should return 400 for duplicate prompt ID', async () => {
    const prompt = { name: 'Dup', content: 'test' };
    // Create once
    const res1 = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    expect(res1.status).toBe(201);
    // Try to create again with same name (ID is derived from name)
    const res2 = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    expect(res2.status).toBe(400);
  });

  it('should return 400 for template variable mismatches', async () => {
    // Variable used but not declared
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
    // Variable declared but not used
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

describe('Workflow Engine Integration', () => {
  const workflowId = 'sample-workflow';
  let sampleWorkflow: any;
  let promptId: string;

  beforeAll(async () => {
    sampleWorkflow = JSON.parse(fs.readFileSync(SAMPLE_WORKFLOW_PATH, 'utf8'));
    // Create the required 'basic-template' prompt
    const prompt = {
      content: 'Echo: {{text}}',
      id: 'basic-template',
      isTemplate: true,
      name: 'Basic Template',
      variables: ['text'],
    };
    // Use the same promptService as the server
    await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    promptId = prompt.id;
  });

  it('should save and run a sample workflow', async () => {
    // Save workflow
    const saveRes = await request(baseUrl)
      .post('/api/v1/workflows')
      .set('x-api-key', 'test-key')
      .send(sampleWorkflow);
    expect(saveRes.status).toBe(201);
    expect(saveRes.body.id).toBe(workflowId);
    // Run workflow
    const runRes = await request(baseUrl)
      .post(`/api/v1/workflows/${workflowId}/run`)
      .set('x-api-key', 'test-key')
      .send();
    // Accept 200 or 400 (if http step fails due to network)
    expect([200, 400]).toContain(runRes.status);
    expect(runRes.body).toHaveProperty('message');
    expect(runRes.body).toHaveProperty('success');
    expect(runRes.body).toHaveProperty('outputs');
    // Outputs should include promptResult, shellResult, httpResult
    expect(runRes.body.outputs).toHaveProperty('promptResult');
    expect(runRes.body.outputs).toHaveProperty('shellResult');
    expect(runRes.body.outputs).toHaveProperty('httpResult');
  });

  it('should enforce workflow rate limiting', async () => {
    // Send 3 concurrent requests (default limit)
    const runPromises = [1, 2, 3].map(() =>
      request(baseUrl)
        .post(`/api/v1/workflows/${workflowId}/run`)
        .set('x-user-id', 'ratelimit-test')
        .set('x-api-key', 'test-key')
        .send(),
    );

    // Start the first 3 requests
    const runResults = Promise.all(runPromises);

    // Immediately try a 4th request while others are still running
    const res429 = await request(baseUrl)
      .post(`/api/v1/workflows/${workflowId}/run`)
      .set('x-user-id', 'ratelimit-test')
      .set('x-api-key', 'test-key')
      .send();

    // 4th request should be rejected with 429
    expect(res429.status).toBe(429);
    expect(res429.body.error).toBe(true);
    expect(res429.body.message).toMatch(/Too many concurrent workflows/);

    // Wait for the first 3 requests to complete
    const results = await runResults;
    results.forEach(res => expect([200, 400]).toContain(res.status));
  });

  it('should log workflow runs to the audit log', () => {
    const logPath = path.join(process.cwd(), 'logs', 'workflow-audit.log');
    expect(fs.existsSync(logPath)).toBe(true);
    const logContent = fs.readFileSync(logPath, 'utf8');
    expect(logContent).toMatch(/sample-workflow/);
    expect(logContent).toMatch(/start/);
    expect(logContent).toMatch(/end/);
  });
});

/**
 *
 * @param ms
 */
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
