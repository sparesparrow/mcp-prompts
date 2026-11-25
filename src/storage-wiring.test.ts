import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { startHttpServer, type HttpServerApp } from './http-server';
import { createMcpServer } from './mcp-prompts-server';
import { DEFAULT_OPTIONS, mergeOptions } from './server-options';
import { PromptStorageError, PromptStore, type StoredPrompt } from './prompt-store';
import { staleChangeError, type StateBackend, type StateSnapshot } from './state-backend';
import { createPostgresPool } from './storage/postgres';

// What the store being backed by a database changes for the servers on top of it: what they say
// about storage, and what a request sees of changes other servers saved.

class Database {
  readonly prompts = new Map<string, StoredPrompt>();
  rev = 0;
}

class FakePostgres implements StateBackend {
  readonly kind = 'postgres' as const;
  writable = true;
  unreachable = false;
  constructor(readonly db: Database = new Database()) {}
  async load(): Promise<StateSnapshot> {
    return { prompts: Array.from(this.db.prompts.values()), tombstones: [] };
  }
  async revision(): Promise<string> {
    if (this.unreachable) throw new PromptStorageError('Could not check the database for changes (ECONNREFUSED)');
    return String(this.db.rev);
  }
  async put(prompt: StoredPrompt, mode: 'create' | 'replace', expected?: string | null): Promise<void> {
    if (mode === 'replace' && expected !== undefined && expected !== null && String(this.db.prompts.get(prompt.id)?.version) !== expected) throw staleChangeError(prompt.id);
    this.db.prompts.set(prompt.id, prompt);
    this.db.rev++;
  }
  async remove(id: string): Promise<void> {
    this.db.prompts.delete(id);
    this.db.rev++;
  }
}

let root: string;
let library: string;
beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-wiring-'));
  library = path.join(root, 'library');
  fs.mkdirSync(library, { recursive: true });
  fs.writeFileSync(path.join(library, 'lib-a.json'), JSON.stringify({ id: 'lib-a', name: 'Library A', content: 'a' }));
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const open = async (backend: StateBackend, refreshIntervalMs = 60_000) => {
  const store = new PromptStore();
  store.load({ promptsDir: library });
  await store.useBackend(backend, { refreshIntervalMs });
  return store;
};

interface ToolResult { isError?: boolean; content: Array<{ type: string; text: string }>; structuredContent?: Record<string, unknown> }

const closers: Array<() => Promise<void>> = [];
afterEach(async () => {
  await Promise.all(closers.splice(0).map(close => close()));
});

async function connect(store: PromptStore): Promise<Client> {
  const server = await createMcpServer({ store });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'wiring-test', version: '1.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  await client.listTools();
  closers.push(async () => { await client.close(); await server.close(); });
  return client;
}
const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as ToolResult;

describe('MCP tools over a Postgres store', () => {
  it('say the changes are saved to the database, and report the storage', async () => {
    const client = await connect(await open(new FakePostgres()));
    expect(client.getInstructions()).toContain("saved to this server's database and survive a restart");
    expect(client.getInstructions()).not.toContain('state directory');
    const added = await call(client, 'add_prompt', { id: 'kept', name: 'Kept', content: 'c' });
    expect(added.isError).toBeFalsy();
    expect(added.structuredContent).toMatchObject({ persisted: true });
    expect(added.content[0].text).toContain('Saved to the database; it survives a restart.');
    expect((await call(client, 'get_stats')).structuredContent).toMatchObject({ storage: 'postgres' });
    const deleted = await call(client, 'delete_prompt', { id: 'kept' });
    expect(deleted.content[0].text).toContain('The deletion is saved; it stays deleted after a restart.');
  });

  it('keep the words they use for a state directory and for memory', async () => {
    const memory = await connect(new PromptStore());
    expect(memory.getInstructions()).toContain('change memory only');
    const dir = path.join(root, 'state');
    const filed = new PromptStore();
    filed.load({ promptsDir: library });
    filed.openStateDir(dir);
    const client = await connect(filed);
    expect(client.getInstructions()).toContain("saved to this server's state directory");
    expect((await call(client, 'add_prompt', { name: 'x', content: 'c' })).content[0].text).toContain('Saved to the state directory');
  });

  it('tell a stale change from a taken id, and what to do about each', async () => {
    const db = new Database();
    const mine = await open(new FakePostgres(db), 60_000);
    await mine.add({ id: 'doc', name: 'Doc', content: 'c', isTemplate: false, tags: [] });
    const theirs = await open(new FakePostgres(db), 60_000);
    await theirs.update('doc', { name: 'Theirs' });
    // `mine` has not looked again yet: its update conflicts, and the message says to retry.
    const client = await connect(mine);
    const stale = await call(client, 'update_prompt', { id: 'doc', updates: { content: 'Mine' } });
    expect(stale.isError).toBe(true);
    expect(stale.content[0].text).toContain('read it again and retry');
    expect(stale.content[0].text).not.toContain('Choose another id');
    const taken = await call(client, 'add_prompt', { id: 'doc', name: 'Again', content: 'c' });
    expect(taken.isError).toBe(true);
    expect(taken.content[0].text).toContain('Choose another id');
    // The stale store has caught up, so the same call now succeeds.
    expect((await call(client, 'update_prompt', { id: 'doc', updates: { content: 'Mine' } })).isError).toBeFalsy();
  });
});

describe('HTTP over a Postgres store', () => {
  let app: HttpServerApp;
  const serve = async (store: PromptStore) => {
    app = await startHttpServer(0, '127.0.0.1', { store });
    closers.push(() => app.close());
    return `http://127.0.0.1:${app.address()!.port}`;
  };
  const json = async (res: Response) => (await res.json()) as Record<string, unknown>;

  it('reports postgres as the storage in /ready and /v1/stats', async () => {
    const base = await serve(await open(new FakePostgres()));
    expect(await json(await fetch(`${base}/ready`))).toMatchObject({ status: 'ready', storage: 'postgres' });
    expect(await json(await fetch(`${base}/v1/stats`))).toMatchObject({ storage: 'postgres' });
  });

  it('is not ready while the database cannot be reached, and says nothing more', async () => {
    const backend = new FakePostgres();
    const base = await serve(await open(backend));
    backend.unreachable = true;
    const res = await fetch(`${base}/ready`);
    expect(res.status).toBe(503);
    const body = await json(res);
    expect(body).toMatchObject({ status: 'unavailable' });
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    // Reads keep being served from memory.
    expect((await fetch(`${base}/v1/prompts/lib-a`)).status).toBe(200);
    backend.unreachable = false;
    expect((await fetch(`${base}/ready`)).status).toBe(200);
  });

  it('shows a request what another server saved, however short ago, before it answers', async () => {
    const db = new Database();
    const base = await serve(await open(new FakePostgres(db), 60_000));
    const other = await open(new FakePostgres(db), 60_000);
    await other.add({ id: 'just-now', name: 'Just now', content: 'c', isTemplate: false, tags: [] });
    expect((await fetch(`${base}/v1/prompts/just-now`)).status).toBe(200);
    await other.delete('just-now');
    expect((await fetch(`${base}/v1/prompts/just-now`)).status).toBe(404);
    await other.add({ id: 'again', name: 'Again', content: 'c', isTemplate: false, tags: [] });
    const list = await json(await fetch(`${base}/v1/prompts`));
    expect((list.prompts as Array<{ id: string }>).map(prompt => prompt.id)).toContain('again');
  });

  it('applies a change on top of what another server saved a moment ago, instead of refusing it', async () => {
    const db = new Database();
    const store = await open(new FakePostgres(db), 60_000);
    const base = await serve(store);
    await store.update('lib-a', { name: 'First' });
    await (await open(new FakePostgres(db), 60_000)).update('lib-a', { name: 'Theirs' });
    const put = await fetch(`${base}/v1/prompts/lib-a`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Mine' }),
    });
    expect(put.status).toBe(200);
    expect(await json(put)).toMatchObject({ name: 'Theirs', content: 'Mine', version: 4 });
  });

  it('is not ready when the database does not answer in time', async () => {
    const backend = new FakePostgres();
    const store = await open(backend);
    app = await startHttpServer(0, '127.0.0.1', { store, readyTimeoutMs: 200 });
    closers.push(() => app.close());
    const base = `http://127.0.0.1:${app.address()!.port}`;
    backend.revision = () => new Promise<string>(() => undefined);
    const started = Date.now();
    const res = await fetch(`${base}/ready`, { signal: AbortSignal.timeout(4_000) });
    expect(res.status).toBe(503);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(JSON.stringify(await json(res))).not.toContain('timed out');
  });

  it('checks the database of a read-only install too, and reports its storage as memory like a read-only state directory does', async () => {
    const backend = new FakePostgres();
    backend.writable = false;
    const base = await serve(await open(backend));
    expect(await json(await fetch(`${base}/ready`))).toMatchObject({ status: 'ready', storage: 'memory' });
    expect(await json(await fetch(`${base}/v1/stats`))).toMatchObject({ storage: 'memory' });
    backend.unreachable = true;
    expect((await fetch(`${base}/ready`)).status).toBe(503);
  });

  it('does not make reads wait for a database that hangs', async () => {
    const backend = new FakePostgres();
    const base = await serve(await open(backend));
    backend.revision = () => new Promise<string>(() => undefined);
    const started = Date.now();
    const res = await fetch(`${base}/v1/prompts/lib-a`, { signal: AbortSignal.timeout(4_000) });
    expect(res.status).toBe(200);
    expect(Date.now() - started).toBeLessThan(3_000);
  }, 10_000);

  it('answers 409 when a change is stale all the same', async () => {
    const backend = new FakePostgres();
    const store = await open(backend);
    const base = await serve(store);
    backend.put = async () => { throw staleChangeError('lib-a'); };
    const put = await fetch(`${base}/v1/prompts/lib-a`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: 'Mine' }),
    });
    expect(put.status).toBe(409);
    expect(String((await json(put)).error)).toContain('read it again and retry');
  });
});

describe.skipIf(!process.env.TEST_DATABASE_URL)('the HTTP server with MCP_PROMPTS_STORAGE=postgres', () => {
  const owner = `test-wiring-${crypto.randomBytes(4).toString('hex')}`;
  const env = { DATABASE_URL: process.env.TEST_DATABASE_URL };
  afterAll(async () => {
    const pool = createPostgresPool(process.env.TEST_DATABASE_URL!);
    for (const table of ['prompts', 'tombstones', 'revisions']) await pool.query(`DELETE FROM ${table} WHERE owner_sub = $1`, [owner]);
    await pool.end();
  });

  it('opens the database itself, saves for the owner, and a second server of the same owner serves it', async () => {
    const serverOptions = mergeOptions(DEFAULT_OPTIONS, { promptsDir: library, storage: 'postgres', owner });
    const first = await startHttpServer(0, '127.0.0.1', { serverOptions, env });
    const second = await startHttpServer(0, '127.0.0.1', { serverOptions, env });
    const urlOf = (app: HttpServerApp) => `http://127.0.0.1:${app.address()!.port}`;
    const created = await fetch(`${urlOf(first)}/v1/prompts`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'over-http', name: 'Over HTTP', content: 'c' }),
    });
    expect(created.status).toBe(201);
    // No waiting for a refresh interval: the second server asks before it answers.
    const read = await fetch(`${urlOf(second)}/v1/prompts/over-http`);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({ name: 'Over HTTP' });
    expect(await (await fetch(`${urlOf(second)}/ready`)).json()).toMatchObject({ status: 'ready', storage: 'postgres' });
    await second.close();
    await first.close();
  });
});

describe('MCP reads over a Postgres store after a quiet time', () => {
  const add = (store: PromptStore, id: string, name = id) =>
    store.add({ id, name, content: `${name} content`, isTemplate: false, tags: [] });

  it('show the first read what another server saved, whatever the refresh interval', async () => {
    const db = new Database();
    const mine = await open(new FakePostgres(db), 60_000);
    const theirs = await open(new FakePostgres(db), 60_000);
    const client = await connect(mine);
    // Mine has not looked at the database for a minute (the interval is longer than the test).
    await add(theirs, 'from-b', 'From B');
    const got = await call(client, 'get_prompt', { id: 'from-b' });
    expect(got.isError).toBeFalsy();
    expect(got.structuredContent).toMatchObject({ name: 'From B' });

    await theirs.update('from-b', { name: 'Renamed on B' });
    expect((await call(client, 'get_prompt', { id: 'from-b' })).structuredContent).toMatchObject({ name: 'Renamed on B' });

    await add(theirs, 'second', 'Second');
    const listed = await call(client, 'list_prompts', { search: 'second' });
    expect(listed.structuredContent).toMatchObject({ total: 1 });
    await theirs.delete('from-b');
    expect((await call(client, 'get_prompt', { id: 'from-b' })).isError).toBe(true);
  });

  it('also covers prompts/get and resources/read, and the lists', async () => {
    const db = new Database();
    const mine = await open(new FakePostgres(db), 60_000);
    const theirs = await open(new FakePostgres(db), 60_000);
    const server = await createMcpServer({ store: mine, expose: ['tools', 'prompts', 'resources'] });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: 'wiring-test', version: '1.0.0' });
    await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
    closers.push(async () => { await client.close(); await server.close(); });
    await add(theirs, 'later', 'Later');
    expect((await client.listPrompts()).prompts.map(p => p.name)).toContain('later');
    await add(theirs, 'later-2', 'Later 2');
    expect((await client.listResources()).resources.map(r => r.name)).toContain('later-2');
    await add(theirs, 'later-3', 'Later 3');
    expect((await client.getPrompt({ name: 'later-3' })).messages[0].content).toMatchObject({ text: 'Later 3 content' });
    await add(theirs, 'later-4', 'Later 4');
    expect((await client.readResource({ uri: 'prompts://later-4' })).contents[0]).toMatchObject({ text: 'Later 4 content' });
  });

  it('also holds for an MCP client of the HTTP server', async () => {
    const db = new Database();
    const mine = await open(new FakePostgres(db), 60_000);
    const theirs = await open(new FakePostgres(db), 60_000);
    const app = await startHttpServer(0, '127.0.0.1', { store: mine });
    closers.push(() => app.close());
    const client = new Client({ name: 'wiring-http', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${app.address()!.port}/mcp`)));
    closers.push(() => client.close());
    await add(theirs, 'over-http', 'Over HTTP');
    const got = (await client.callTool({ name: 'get_prompt', arguments: { id: 'over-http' } })) as ToolResult;
    expect(got.isError).toBeFalsy();
    expect(got.structuredContent).toMatchObject({ name: 'Over HTTP' });
  });

  it('does not make a tool wait for a database that hangs', async () => {
    const backend = new FakePostgres();
    const client = await connect(await open(backend, 60_000));
    backend.revision = () => new Promise<string>(() => undefined);
    const started = Date.now();
    const got = await call(client, 'get_prompt', { id: 'lib-a' });
    expect(got.isError).toBeFalsy();
    expect(Date.now() - started).toBeLessThan(3_000);
  });
});
