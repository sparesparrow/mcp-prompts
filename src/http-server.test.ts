import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer, startHttpServer, type HttpServerApp, type Route } from './http-server';
import { PromptStore } from './prompt-store';
import { mergeOptions, DEFAULT_OPTIONS } from './server-options';
import { makeFixtureLibrary, type FixtureLibrary } from './testing/fixture-library';

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
      'GET /mcp/tools', 'POST /mcp/tools/:name', 'POST /mcp',
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

describe('MCP over HTTP at /mcp', () => {
  let fixture: FixtureLibrary;
  let open: HttpServerApp;
  let narrowed: HttpServerApp;
  const clients: Client[] = [];

  const urlOf = (app: HttpServerApp, query = '') => `http://127.0.0.1:${app.address()!.port}/mcp${query}`;

  const connect = async (url: string) => {
    const client = new Client({ name: 'http-mcp-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    clients.push(client);
    return client;
  };

  beforeAll(async () => {
    fixture = makeFixtureLibrary();
    // One server serving its whole library, one started with a selection and read-only.
    open = await startHttpServer(0, '127.0.0.1', {
      serverOptions: mergeOptions(DEFAULT_OPTIONS, { promptsDir: fixture.library }),
    });
    narrowed = await startHttpServer(0, '127.0.0.1', {
      serverOptions: mergeOptions(DEFAULT_OPTIONS, { promptsDir: fixture.library, prompts: [], templates: ['alpha'], readOnly: true }),
    });
  });

  afterAll(async () => {
    await Promise.all(clients.map(client => client.close()));
    await open.close();
    await narrowed.close();
    fixture.cleanup();
  });

  it('serves the whole library with the default tools when the URL chooses nothing', async () => {
    const client = await connect(urlOf(open));
    const tools = (await client.listTools()).tools.map(t => t.name);
    expect(tools).toEqual(expect.arrayContaining(['add_prompt', 'list_prompts', 'apply_template']));
    expect(client.getServerCapabilities()?.prompts).toBeUndefined();
    const stats = await client.callTool({ name: 'get_stats', arguments: {} });
    expect(JSON.parse((stats.content as Array<{ text: string }>)[0].text)).toMatchObject({ total: 6 });
  });

  it('takes the selection, capabilities and read-only from the query string', async () => {
    const client = await connect(urlOf(open, '?prompts=none&templates=beta,a-greet&expose=prompts,resources&readOnly=true'));
    expect(client.getServerCapabilities()?.tools).toBeUndefined();
    const { prompts } = await client.listPrompts();
    expect(prompts.map(p => p.name).sort()).toEqual(['a-greet', 'b-tmpl']);
    const filled = await client.getPrompt({ name: 'a-greet', arguments: { who: 'HTTP', place: 'the URL' } });
    expect((filled.messages[0].content as { text: string }).text).toBe('Hello HTTP from the URL');
    const { resources } = await client.listResources();
    expect(resources.map(r => r.uri).sort()).toEqual(['prompts://a-greet', 'prompts://b-tmpl']);
    expect(client.getInstructions()).toContain('2 of the 6 library prompts');
  });

  it('can only narrow what the server itself serves', async () => {
    // The server serves alpha templates and is read-only; the URL asks for beta and writes.
    const client = await connect(urlOf(narrowed, '?templates=alpha/deep,beta&readOnly=false'));
    const tools = (await client.listTools()).tools.map(t => t.name);
    expect(tools).not.toContain('add_prompt');
    const listed = await client.callTool({ name: 'list_prompts', arguments: {} });
    const text = (listed.content as Array<{ text: string }>)[0].text;
    expect(text).toContain('Found 1 prompts');
    expect(text).toContain('(a-deep)');
  });

  it('keeps prompts added through one session for the next, as the stdio server does', async () => {
    const first = await connect(urlOf(open, '?expose=tools,prompts'));
    const added = await first.callTool({ name: 'add_prompt', arguments: { name: 'Added over HTTP', content: 'hi' } });
    const id = /ID: (\S+)/.exec((added.content as Array<{ text: string }>)[0].text)?.[1];
    const second = await connect(urlOf(open, '?expose=prompts&prompts=none&templates=none'));
    expect((await second.listPrompts()).prompts.map(p => p.name)).toEqual([id]);
  });

  it('answers 400 for unknown or invalid query parameters, and 405 for GET', async () => {
    const post = (query: string) => fetch(urlOf(open, query), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
    });
    const unknown = await post('?promptsDir=/etc');
    expect(unknown.status).toBe(400);
    expect(((await unknown.json()) as { error: string }).error).toMatch(/unknown query parameter promptsDir/);
    expect((await post('?expose=sampling')).status).toBe(400);
    const get = await fetch(urlOf(open), { method: 'GET' });
    expect(get.status).toBe(405);
    expect(get.headers.get('allow')).toBe('POST');
  });

  it('leaves the write routes out of a read-only server', async () => {
    const base = `http://127.0.0.1:${narrowed.address()!.port}`;
    const create = await fetch(`${base}/v1/prompts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x', content: 'y' }),
    });
    expect(create.status).toBe(405);
    const tools = await (await fetch(`${base}/mcp/tools`)).json() as { tools: Array<{ name: string }> };
    expect(tools.tools.map((t: { name: string }) => t.name)).not.toContain('add_prompt');
    const listed = await (await fetch(`${base}/v1/prompts`)).json() as { prompts: Array<{ id: string }> };
    expect(listed.prompts.map((p: { id: string }) => p.id).sort()).toEqual(['a-deep', 'a-greet']);
  });
});
