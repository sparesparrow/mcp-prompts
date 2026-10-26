import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, startHttpServer, type HttpServerApp, type Route } from './http-server';
import { PromptStore } from './prompt-store';

// Route handlers are called directly for the health endpoints, then the whole server is
// exercised over real HTTP on an ephemeral port.

function findRoute(app: HttpServerApp, method: string, path: string): Route {
  const route = app.routes.find(r => r.method === method && r.path === path);
  if (!route) throw new Error(`No route ${method} ${path}`);
  return route;
}

function callHandler(route: Route): unknown {
  let payload: unknown = null;
  const res = {
    status: () => res,
    json: (data: unknown) => { payload = data; return res; },
    end: () => res,
  };
  route.handler({ params: {}, query: new URLSearchParams(), body: undefined }, res);
  return payload;
}

describe('http-server routes', () => {
  it('keeps the health endpoints and adds the prompt API', async () => {
    const app = await createServer({ store: new PromptStore() });
    const routes = app._router.stack.map(layer => `${layer.route.method} ${layer.route.path}`);
    expect(routes).toEqual(expect.arrayContaining([
      'GET /health', 'GET /ready', 'GET /version',
      'GET /v1/prompts', 'POST /v1/prompts', 'GET /v1/prompts/:id', 'PUT /v1/prompts/:id',
      'DELETE /v1/prompts/:id', 'POST /v1/prompts/:id/apply', 'GET /v1/stats',
      'GET /mcp/tools', 'POST /mcp/tools/:name',
    ]));
  });

  it('/health returns status=ok, service=mcp-prompts and an ISO timestamp', async () => {
    const app = await createServer({ store: new PromptStore() });
    const payload = callHandler(findRoute(app, 'GET', '/health')) as { status: string; service: string; timestamp: string };
    expect(payload.status).toBe('ok');
    expect(payload.service).toBe('mcp-prompts');
    expect(new Date(payload.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('/ready returns status=ready, service=mcp-prompts', async () => {
    const app = await createServer({ store: new PromptStore() });
    expect(callHandler(findRoute(app, 'GET', '/ready'))).toEqual({ status: 'ready', service: 'mcp-prompts' });
  });

  it('/version returns the package version and service name', async () => {
    const app = await createServer({ store: new PromptStore() });
    const payload = callHandler(findRoute(app, 'GET', '/version')) as { version: string; service: string };
    expect(payload.service).toBe('mcp-prompts');
    expect(payload.version.length).toBeGreaterThan(0);
  });
});

describe('http-server over HTTP', () => {
  let app: HttpServerApp;
  let base: string;

  const request = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, json: text ? JSON.parse(text) : undefined };
  };

  beforeAll(async () => {
    app = await startHttpServer(0, '127.0.0.1', { store: new PromptStore(), corsOrigin: 'https://example.test' });
    base = `http://127.0.0.1:${app.address()!.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  it('actually listens and answers /health', async () => {
    const res = await request('GET', '/health');
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('ok');
    expect(res.headers.get('access-control-allow-origin')).toBe('https://example.test');
  });

  it('creates, reads, lists, updates, applies and deletes a prompt', async () => {
    const created = await request('POST', '/v1/prompts', {
      name: 'Greeting', content: 'Hello {{who}} from {{place}}', isTemplate: true, tags: ['http-test'],
    });
    expect(created.status).toBe(201);
    const id = created.json.id as string;
    expect(id).toMatch(/^prompt_/);

    const fetched = await request('GET', `/v1/prompts/${encodeURIComponent(id)}`);
    expect(fetched.status).toBe(200);
    expect(fetched.json.content).toBe('Hello {{who}} from {{place}}');

    const listed = await request('GET', '/v1/prompts?tags=http-test');
    expect(listed.json.prompts.map((p: { id: string }) => p.id)).toEqual([id]);
    const searched = await request('GET', '/v1/prompts?search=greet');
    expect(searched.json.prompts).toHaveLength(1);

    const updated = await request('PUT', `/v1/prompts/${id}`, { name: 'Greeting v2' });
    expect(updated.status).toBe(200);
    expect(updated.json).toMatchObject({ name: 'Greeting v2', version: 2 });

    const applied = await request('POST', `/v1/prompts/${id}/apply`, { variables: { who: 'Brno', place: 'MCP' } });
    expect(applied.json.result).toBe('Hello Brno from MCP');

    const stats = await request('GET', '/v1/stats');
    expect(stats.json).toMatchObject({ total: 1, templates: 1 });

    const deleted = await request('DELETE', `/v1/prompts/${id}`);
    expect(deleted.status).toBe(204);
    expect((await request('GET', `/v1/prompts/${id}`)).status).toBe(404);
  });

  it('exposes the MCP tools over HTTP', async () => {
    const tools = await request('GET', '/mcp/tools');
    expect(tools.json.tools.map((t: { name: string }) => t.name)).toEqual(expect.arrayContaining([
      'list_prompts', 'get_prompt', 'add_prompt', 'update_prompt', 'delete_prompt', 'apply_template', 'get_stats',
    ]));

    const added = await request('POST', '/mcp/tools/add_prompt', { arguments: { name: 'Via tool', content: 'x' } });
    expect(added.status).toBe(200);
    const got = await request('POST', '/mcp/tools/get_prompt', { arguments: { id: added.json.result.id } });
    expect(got.json.result.name).toBe('Via tool');

    expect((await request('POST', '/mcp/tools/nope', {})).status).toBe(404);
  });

  it('answers errors with proper status codes', async () => {
    expect((await request('GET', '/v1/prompts/missing')).status).toBe(404);
    expect((await request('GET', '/no/such/path')).status).toBe(404);

    const invalid = await request('POST', '/v1/prompts', { name: 'no content' });
    expect(invalid.status).toBe(400);
    expect(invalid.json.error).toBe('Invalid request');

    expect((await request('POST', '/v1/prompts', '{not json')).status).toBe(400);

    const plain = await request('POST', '/v1/prompts', { name: 'Plain', content: 'no vars' });
    const notTemplate = await request('POST', `/v1/prompts/${plain.json.id}/apply`, { variables: {} });
    expect(notTemplate.status).toBe(400);

    const wrongMethod = await request('PATCH', '/v1/stats');
    expect(wrongMethod.status).toBe(405);
    expect(wrongMethod.headers.get('allow')).toBe('GET');
  });

  it('rejects bodies over 1 MB', async () => {
    const res = await fetch(`${base}/v1/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'big', content: 'x'.repeat(1024 * 1024 + 10) }),
    }).catch(() => null);
    // The server answers 413 and closes the connection; either outcome means it refused the body.
    if (res) expect(res.status).toBe(413);
  });
});
