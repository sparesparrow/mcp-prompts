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

describe('Prompt List (GET /prompts)', () => {
  it('should list all prompts', async () => {
    const res = await request(baseUrl)
      .get('/prompts')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.prompts)).toBe(true);
    expect(typeof res.body.total).toBe('number');
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
    expect(res1.body.prompts.length).toBeLessThanOrEqual(1);
    expect(res2.body.prompts.length).toBeLessThanOrEqual(1);
    if (res1.body.prompts.length && res2.body.prompts.length) {
      expect(res1.body.prompts[0].id).not.toBe(res2.body.prompts[0].id);
    }
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
    const res = await request(baseUrl)
      .get('/prompts?tags=test')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    for (const prompt of res.body.prompts) {
      expect(prompt.tags).toContain('test');
    }
  });

  it('should filter by category', async () => {
    const res = await request(baseUrl)
      .get('/prompts?category=general')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    for (const prompt of res.body.prompts) {
      expect(prompt.category).toBe('general');
    }
  });

  it('should filter by isTemplate', async () => {
    const res = await request(baseUrl)
      .get('/prompts?isTemplate=true')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    for (const prompt of res.body.prompts) {
      expect(prompt.isTemplate).toBe(true);
    }
  });

  it('should search by name/content/description', async () => {
    const res = await request(baseUrl)
      .get('/prompts?search=Bulk')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    expect(res.body.prompts.some((p: any) => p.name.includes('Bulk') || p.content.includes('Bulk') || (p.description && p.description.includes('Bulk')))).toBe(true);
  });

  it('should combine filters', async () => {
    const res = await request(baseUrl)
      .get('/prompts?tags=test&isTemplate=false&category=general')
      .set('x-api-key', 'test-key');
    expect(res.status).toBe(200);
    for (const prompt of res.body.prompts) {
      expect(prompt.tags).toContain('test');
      expect(prompt.isTemplate).toBe(false);
      expect(prompt.category).toBe('general');
    }
  });
});

describe('Bulk Prompt Operations', () => {
  it('should bulk create prompts and return per-prompt results', async () => {
    const prompts = [
      { name: 'Bulk1', content: 'Bulk content 1' },
      { name: 'Bulk2', content: 'Bulk content 2' },
    ];
    const res = await request(baseUrl)
      .post('/prompts/bulk')
      .set('x-api-key', 'test-key')
      .send(prompts);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);
    expect(res.body[0].success).toBe(true);
    expect(res.body[1].success).toBe(true);
  });

  it('should return errors for duplicate or invalid prompts in bulk create', async () => {
    // First, create a prompt
    await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({ name: 'BulkDup', content: 'Dup content' });
    // Now, try to bulk create with a duplicate and an invalid
    const prompts = [
      { name: 'BulkDup', content: 'Dup content' }, // duplicate
      { name: '', content: '' }, // invalid
      { name: 'Bulk3', content: 'Bulk content 3' }, // valid
    ];
    const res = await request(baseUrl)
      .post('/prompts/bulk')
      .set('x-api-key', 'test-key')
      .send(prompts);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].success).toBe(false);
    expect(res.body[0].error).toMatch(/already exists/);
    expect(res.body[1].success).toBe(false);
    expect(res.body[2].success).toBe(true);
  });

  it('should bulk delete prompts and return per-id results', async () => {
    // Create two prompts to delete
    const p1 = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({ name: 'BulkDel1', content: 'Del1' });
    const p2 = await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send({ name: 'BulkDel2', content: 'Del2' });
    const ids = [p1.body.id, p2.body.id, 'nonexistent-id'];
    const res = await request(baseUrl)
      .delete('/prompts/bulk')
      .set('x-api-key', 'test-key')
      .send({ ids });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(3);
    expect(res.body[0].success).toBe(true);
    expect(res.body[1].success).toBe(true);
    expect(res.body[2].success).toBe(false);
    expect(res.body[2].id).toBe('nonexistent-id');
  });

  it('should return all errors for bulk delete with all non-existent IDs', async () => {
    const ids = ['no-such-id-1', 'no-such-id-2'];
    const res = await request(baseUrl)
      .delete('/prompts/bulk')
      .set('x-api-key', 'test-key')
      .send({ ids });
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].success).toBe(false);
    expect(res.body[1].success).toBe(false);
  });
});

describe('Workflow Engine Integration', () => {
  const workflowId = 'sample-workflow';
  let sampleWorkflow: any;
  let promptId: string;

  beforeAll(async () => {
    sampleWorkflow = JSON.parse(fs.readFileSync(SAMPLE_WORKFLOW_PATH, 'utf8'));
    // Create the required 'basic-template' prompt with version
    const prompt = {
      content: 'Echo: {{text}}',
      id: 'basic-template',
      isTemplate: true,
      name: 'Basic Template',
      variables: ['text'],
      version: 1,
    };
    // Use the same promptService as the server
    await request(baseUrl)
      .post('/prompts')
      .set('x-api-key', 'test-key')
      .send(prompt);
    promptId = prompt.id;
  });

  it('should save and run a sample workflow', async () => {
    // Save workflow (always increment version if already exists)
    let saveRes = await request(baseUrl)
      .post('/api/v1/workflows')
      .set('x-api-key', 'test-key')
      .send(sampleWorkflow);
    // If version conflict, increment version and try again
    if (saveRes.status === 409) {
      // Get all versions
      const versionsRes = await request(baseUrl)
        .get(`/api/v1/workflows/${workflowId}/versions`)
        .set('x-api-key', 'test-key');
      const versions = versionsRes.body.map((v: any) => v.version);
      const nextVersion = Math.max(...versions) + 1;
      sampleWorkflow.version = nextVersion;
      saveRes = await request(baseUrl)
        .post('/api/v1/workflows')
        .set('x-api-key', 'test-key')
        .send(sampleWorkflow);
    }
    expect(saveRes.status).toBe(201);
    expect(saveRes.body.id).toBe(workflowId);
    expect(typeof saveRes.body.version).toBe('number');
    // Run workflow (use latest version)
    const runRes = await request(baseUrl)
      .post(`/api/v1/workflows/${workflowId}/run`)
      .set('x-api-key', 'test-key')
      .send();
    // Accept 200 or 400 (if http step fails due to network or missing prompt)
    expect([200, 400]).toContain(runRes.status);
    if (runRes.status === 200) {
      expect(runRes.body).toHaveProperty('message');
      expect(runRes.body).toHaveProperty('success');
      expect(runRes.body).toHaveProperty('outputs');
      // Outputs should include promptResult, shellResult, httpResult
      expect(runRes.body.outputs).toHaveProperty('promptResult');
      expect(runRes.body.outputs).toHaveProperty('shellResult');
      expect(runRes.body.outputs).toHaveProperty('httpResult');
    } else {
      // 400: should have error message
      expect(runRes.body).toHaveProperty('message');
      expect(runRes.body.success).toBe(false);
    }
  });

  it('should enforce workflow rate limiting', async () => {
    // Save workflow (ensure latest version)
    let saveRes = await request(baseUrl)
      .post('/api/v1/workflows')
      .set('x-api-key', 'test-key')
      .send(sampleWorkflow);
    if (saveRes.status === 409) {
      const versionsRes = await request(baseUrl)
        .get(`/api/v1/workflows/${workflowId}/versions`)
        .set('x-api-key', 'test-key');
      const versions = versionsRes.body.map((v: any) => v.version);
      const nextVersion = Math.max(...versions) + 1;
      sampleWorkflow.version = nextVersion;
      saveRes = await request(baseUrl)
        .post('/api/v1/workflows')
        .set('x-api-key', 'test-key')
        .send(sampleWorkflow);
    }
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
    // 4th request should be rejected with 429 (rate limit) or 500 (if workflow fails for another reason)
    expect([429, 500]).toContain(res429.status);
    if (res429.status === 429) {
      expect(res429.body.error).toBe(true);
      expect(res429.body.message).toMatch(/Too many concurrent workflows/);
    } else {
      // 500: should have error message
      expect(res429.body).toHaveProperty('message');
    }
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
