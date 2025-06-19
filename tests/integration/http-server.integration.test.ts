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

describe('Workflow Engine Integration', () => {
  const workflowId = 'sample-workflow';
  let sampleWorkflow: any;
  let promptId: string;

  beforeAll(async () => {
    sampleWorkflow = JSON.parse(fs.readFileSync(SAMPLE_WORKFLOW_PATH, 'utf8'));
    // Create the required 'basic-template' prompt
    const prompt = {
      name: 'Basic Template',
      content: 'Echo: {{text}}',
      isTemplate: true,
      id: 'basic-template',
      variables: ['text'],
    };
    // Use the same promptService as the server
    await request(baseUrl).post('/prompts').send(prompt);
    promptId = prompt.id;
  });

  it('should save and run a sample workflow', async () => {
    // Save workflow
    const saveRes = await request(baseUrl).post('/api/v1/workflows').send(sampleWorkflow);
    expect(saveRes.status).toBe(201);
    expect(saveRes.body.id).toBe(workflowId);
    // Run workflow
    const runRes = await request(baseUrl).post(`/api/v1/workflows/${workflowId}/run`).send();
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
        .send(),
    );

    // Start the first 3 requests
    const runResults = Promise.all(runPromises);

    // Immediately try a 4th request while others are still running
    const res429 = await request(baseUrl)
      .post(`/api/v1/workflows/${workflowId}/run`)
      .set('x-user-id', 'ratelimit-test')
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
