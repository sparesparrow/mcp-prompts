import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
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

  it('answers 413 for bodies over 1 MB instead of resetting the connection', async () => {
    const res = await fetch(`${base}/v1/prompts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'big', content: 'x'.repeat(1024 * 1024 + 10) }),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error: string }).error).toMatch(/too large/);
  });

  it('answers 400, not 500, for a path with broken percent-encoding', async () => {
    const res = await request('GET', '/v1/prompts/%E0%A4%A');
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/percent-encoding/);
  });

  it('answers HEAD like GET, without a body', async () => {
    const res = await fetch(`${base}/health`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('takes a JSON body only as application/json', async () => {
    // What a cross-site form post or a no-preflight fetch can send.
    const res = await fetch(`${base}/v1/prompts`, {
      method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ name: 'x', content: 'y' }),
    });
    expect(res.status).toBe(415);
  });

  it('keeps description and category, accepts a chosen id and answers 409 when it is taken', async () => {
    const created = await request('POST', '/v1/prompts', {
      id: 'http-chosen', name: 'Chosen', content: 'c', description: 'kept', category: 'ops',
    });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ id: 'http-chosen', description: 'kept', category: 'ops' });
    expect((await request('POST', '/v1/prompts', { id: 'http-chosen', name: 'Again', content: 'c' })).status).toBe(409);
    expect((await request('POST', '/v1/prompts', { id: '../etc', name: 'Bad', content: 'c' })).status).toBe(400);
    expect((await request('PUT', '/v1/prompts/http-chosen', {})).status).toBe(400);
    expect((await request('PUT', '/v1/prompts/http-chosen', { name: '' })).status).toBe(400);
    await request('DELETE', '/v1/prompts/http-chosen');
  });

  it('pages GET /v1/prompts on request and reports the total', async () => {
    for (const n of [1, 2, 3]) await request('POST', '/v1/prompts', { id: `page-${n}`, name: `Page ${n}`, content: 'c', tags: ['paging'] });
    const all = await request('GET', '/v1/prompts?tags=paging');
    expect(all.json).toMatchObject({ total: 3, count: 3, has_more: false });
    const first = await request('GET', '/v1/prompts?tags=paging&limit=2');
    expect(first.json).toMatchObject({ total: 3, count: 2, has_more: true, next_offset: 2 });
    const second = await request('GET', '/v1/prompts?tags=paging&limit=2&offset=2');
    expect(second.json.prompts.map((p: { id: string }) => p.id)).toEqual(['page-3']);
    expect((await request('GET', '/v1/prompts?limit=0')).status).toBe(400);
    expect((await request('GET', '/v1/prompts?offset=-1')).status).toBe(400);
    for (const n of [1, 2, 3]) await request('DELETE', `/v1/prompts/page-${n}`);
  });
});

describe('HTTP access control', () => {
  const token = 'test-token-0123456789abcdef';
  let guarded: HttpServerApp;
  let local: HttpServerApp;

  // fetch cannot set Host, so these go through node:http.
  const raw = (app: HttpServerApp, options: { method?: string; path: string; headers?: Record<string, string>; body?: string }) =>
    new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const req = http.request({
        host: '127.0.0.1', port: app.address()!.port, method: options.method ?? 'GET', path: options.path, headers: options.headers,
      }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      });
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });

  beforeAll(async () => {
    guarded = await startHttpServer(0, '127.0.0.1', { store: new PromptStore(), authToken: token });
    local = await startHttpServer(0, '127.0.0.1', { store: new PromptStore() });
  });
  afterAll(async () => {
    await guarded.close();
    await local.close();
  });

  it('requires the bearer token for the API and MCP, but not for the health probes', async () => {
    expect((await raw(guarded, { path: '/health' })).status).toBe(200);
    expect((await raw(guarded, { path: '/version' })).status).toBe(200);

    const denied = await raw(guarded, { path: '/v1/prompts' });
    expect(denied.status).toBe(401);
    expect(denied.headers['www-authenticate']).toMatch(/^Bearer/);
    expect((await raw(guarded, { path: '/v1/prompts', headers: { Authorization: 'Bearer wrong-token-0123456789' } })).status).toBe(401);
    expect((await raw(guarded, { path: '/v1/prompts', headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);

    const write = { method: 'POST', path: '/v1/prompts', body: JSON.stringify({ name: 'n', content: 'c' }) };
    expect((await raw(guarded, { ...write, headers: { 'Content-Type': 'application/json' } })).status).toBe(401);
    expect((await raw(guarded, { ...write, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } })).status).toBe(201);
    expect((await raw(guarded, { method: 'POST', path: '/mcp', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(401);
  });

  it('lets an MCP client in with the token in its headers', async () => {
    const url = new URL(`http://127.0.0.1:${guarded.address()!.port}/mcp`);
    const client = new Client({ name: 'auth-test', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: `Bearer ${token}` } } }));
    expect((await client.listTools()).tools.length).toBeGreaterThan(0);
    await client.close();

    const anonymous = new Client({ name: 'auth-test', version: '1.0.0' });
    await expect(anonymous.connect(new StreamableHTTPClientTransport(url))).rejects.toThrow();
  });

  it('refuses a request that arrives under another site\'s name (DNS rebinding)', async () => {
    const rebound = await raw(local, { path: '/v1/prompts', headers: { Host: 'evil.example' } });
    expect(rebound.status).toBe(403);
    expect(rebound.body).toMatch(/MCP_PROMPTS_ALLOWED_HOSTS/);
    expect((await raw(local, { path: '/v1/prompts', headers: { Host: `localhost:${local.address()!.port}` } })).status).toBe(200);
  });

  it('refuses a write sent by a web page from another origin, and allows a local page', async () => {
    const write = { method: 'POST', path: '/v1/prompts', body: JSON.stringify({ name: 'planted', content: 'c' }) };
    const foreign = await raw(local, { ...write, headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' } });
    expect(foreign.status).toBe(403);
    const mcp = await raw(local, { method: 'POST', path: '/mcp', headers: { 'Content-Type': 'application/json', Origin: 'https://evil.example' }, body: '{}' });
    expect(mcp.status).toBe(403);
    const inspector = await raw(local, { ...write, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:6274' } });
    expect(inspector.status).toBe(201);
    const listed = JSON.parse((await raw(local, { path: '/v1/prompts' })).body) as { prompts: Array<{ name: string }> };
    expect(listed.prompts.map(p => p.name)).toEqual(['planted']);
  });
});

describe('startHttpServer start-up', () => {
  it('refuses to listen beyond loopback with writes enabled and no token', async () => {
    await expect(startHttpServer(0, '0.0.0.0', { store: new PromptStore() })).rejects.toThrow(/MCP_PROMPTS_AUTH_TOKEN/);
  });

  it('listens beyond loopback when read-only, with a token, or when told the risk is handled', async () => {
    const readOnly = await startHttpServer(0, '0.0.0.0', {
      store: new PromptStore(), serverOptions: mergeOptions(DEFAULT_OPTIONS, { readOnly: true }),
    });
    const withToken = await startHttpServer(0, '0.0.0.0', { store: new PromptStore(), authToken: 'a-long-enough-secret-token' });
    const insecure = await startHttpServer(0, '0.0.0.0', { store: new PromptStore(), allowInsecure: true });
    // Beyond loopback the server cannot know its public name, so any Host is accepted unless listed.
    const res = await fetch(`http://127.0.0.1:${readOnly.address()!.port}/v1/prompts`);
    expect(res.status).toBe(200);
    await Promise.all([readOnly.close(), withToken.close(), insecure.close()]);
  });

  it('rejects instead of crashing when the port is taken', async () => {
    const first = await startHttpServer(0, '127.0.0.1', { store: new PromptStore() });
    await expect(startHttpServer(first.address()!.port, '127.0.0.1', { store: new PromptStore() })).rejects.toMatchObject({ code: 'EADDRINUSE' });
    await first.close();
  });

  it('saves changes to the state directory of its options and serves them after a restart', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-http-state-'));
    const fixture = makeFixtureLibrary();
    const serverOptions = mergeOptions(DEFAULT_OPTIONS, { promptsDir: fixture.library, stateDir: path.join(dir, 'state') });
    const post = (app: HttpServerApp, body: unknown) => fetch(`http://127.0.0.1:${app.address()!.port}/v1/prompts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });

    const first = await startHttpServer(0, '127.0.0.1', { serverOptions });
    expect((await post(first, { id: 'saved-over-http', name: 'Saved', content: 'c' })).status).toBe(201);
    await first.close();

    const second = await startHttpServer(0, '127.0.0.1', { serverOptions });
    const got = await fetch(`http://127.0.0.1:${second.address()!.port}/v1/prompts/saved-over-http`);
    expect(got.status).toBe(200);
    const stats = await (await fetch(`http://127.0.0.1:${second.address()!.port}/v1/stats`)).json() as { storage: string; total: number };
    expect(stats).toMatchObject({ storage: 'file', total: 7 });
    await second.close();
    fixture.cleanup();
    fs.rmSync(dir, { recursive: true, force: true });
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
