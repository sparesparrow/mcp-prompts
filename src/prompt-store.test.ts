import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as http from 'http';
import type { AddressInfo } from 'net';
import * as os from 'os';
import * as path from 'path';
import { PromptNotFoundError, PromptStore, PromptUsageError, UpdatePromptParams, splitDirs } from './prompt-store';

describe('PromptStore', () => {
  it('keeps isTemplate and tags when an update leaves them out', () => {
    const store = new PromptStore();
    const p = store.add({ name: 'T', content: 'Hi {{x}}', isTemplate: true, tags: ['a'] });
    const updated = store.update(p.id, UpdatePromptParams.parse({ name: 'T2' }));
    expect(updated).toMatchObject({ name: 'T2', isTemplate: true, tags: ['a'], version: 2 });
  });

  it('fills placeholders literally, including names with regex characters', () => {
    const store = new PromptStore();
    const p = store.add({ name: 'T', content: '{{a.b}} and {{a.b}} and {{c}}', isTemplate: true, tags: [] });
    expect(store.applyTemplate(p.id, { 'a.b': 'X', c: 1 })).toBe('X and X and 1');
  });

  it('refuses to apply a prompt that is not a template', () => {
    const store = new PromptStore();
    const p = store.add({ name: 'Plain', content: 'x', isTemplate: false, tags: [] });
    expect(() => store.applyTemplate(p.id, {})).toThrow(PromptUsageError);
  });

  it('reports missing prompts with PromptNotFoundError', () => {
    const store = new PromptStore();
    expect(() => store.get('nope')).toThrow(PromptNotFoundError);
    expect(() => store.delete('nope')).toThrow(PromptNotFoundError);
  });

  it('filters by any matching tag and by search text', () => {
    const store = new PromptStore();
    store.add({ name: 'Alpha', content: 'first', isTemplate: false, tags: ['x'] });
    store.add({ name: 'Beta', content: 'second', isTemplate: false, tags: ['y'] });
    expect(store.list({ tags: ['y', 'z'] }).map(p => p.name)).toEqual(['Beta']);
    expect(store.list({ search: 'FIRST' }).map(p => p.name)).toEqual(['Alpha']);
    expect(store.stats()).toMatchObject({ total: 2, templates: 0, regular: 2 });
  });

  it('loads prompts recursively from a directory, skipping index.json', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
    fs.mkdirSync(path.join(dir, 'sub'));
    fs.writeFileSync(path.join(dir, 'a.json'), JSON.stringify({ id: 'a', name: 'A', content: 'a', tags: [] }));
    fs.writeFileSync(path.join(dir, 'sub', 'b.json'), JSON.stringify({ id: 'b', name: 'B', content: 'b', tags: [] }));
    fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify({ ignored: true }));
    const store = new PromptStore();
    expect(store.loadDirectory(dir)).toBe(2);
    expect(store.get('b').name).toBe('B');
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

// The plugin's settings reach the server as PROMPTS_EXTRA_DIRS and PROMPTS_CATALOG_URL.
describe('PromptStore.loadConfigured', () => {
  const prompt = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, content: name, tags: [], ...extra });
  const writePrompts = (dir: string, prompts: object[]) =>
    prompts.forEach((p, i) => fs.writeFileSync(path.join(dir, `p${i}.json`), JSON.stringify(p)));

  // Routes of a local catalog server: body, status, and an optional delay before answering.
  const routes: Record<string, { body: string; status?: number; delayMs?: number }> = {};
  let server: http.Server;
  let base: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const route = routes[req.url ?? ''];
      if (!route) return void res.writeHead(404).end();
      setTimeout(() => res.writeHead(route.status ?? 200, { 'content-type': 'application/json' }).end(route.body),
        route.delayMs ?? 0);
    });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });

  const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));

  it('layers bundled < catalog < user folders by id, and counts each source', async () => {
    const bundled = tmp();
    const mine = tmp();
    const theirs = tmp();
    writePrompts(bundled, [prompt('shared', 'from bundled'), prompt('only-bundled', 'B')]);
    routes['/layers.json'] = { body: JSON.stringify([prompt('shared', 'from catalog'), prompt('only-catalog', 'C')]) };
    writePrompts(mine, [prompt('shared', 'from my folder')]);
    writePrompts(theirs, [prompt('only-user', 'U')]);

    const store = new PromptStore();
    await store.loadConfigured({
      PROMPTS_DIR: bundled,
      PROMPTS_CATALOG_URL: `${base}/layers.json`,
      PROMPTS_EXTRA_DIRS: [mine, theirs].join(path.delimiter),
    });

    expect(store.get('shared').name).toBe('from my folder');
    expect(store.list().map(p => p.id).sort()).toEqual(['only-bundled', 'only-catalog', 'only-user', 'shared']);
    expect(store.stats().sources).toEqual({ bundled: 1, catalog: 1, user: 2, session: 0 });
    store.add({ name: 'new', content: 'x', isTemplate: false, tags: [] });
    expect(store.stats().sources.session).toBe(1);
  });

  it('skips a missing extra folder and keeps the rest', async () => {
    const bundled = tmp();
    writePrompts(bundled, [prompt('b', 'B')]);
    const store = new PromptStore();
    await store.loadConfigured({ PROMPTS_DIR: bundled, PROMPTS_EXTRA_DIRS: path.join(bundled, 'does-not-exist') });
    expect(store.list().map(p => p.id)).toEqual(['b']);
  });

  it('reads { "prompts": [...] } and skips entries that do not match the schema', async () => {
    routes['/wrapped.json'] = {
      body: JSON.stringify({ prompts: [prompt('ok', 'OK', { description: 'kept' }), { id: 'no-content', name: 'X' }, 42] }),
    };
    const store = new PromptStore();
    expect(await store.loadCatalog(`${base}/wrapped.json`)).toBe(1);
    expect(store.get('ok').description).toBe('kept');
  });

  it.each([
    ['invalid JSON', { body: '{ not json' }],
    ['an object without prompts', { body: JSON.stringify({ items: [] }) }],
    ['an error status', { body: '[]', status: 500 }],
  ])('loads nothing from %s and keeps what was there', async (_label, route) => {
    routes['/bad.json'] = route;
    const store = new PromptStore();
    store.add({ name: 'kept', content: 'k', isTemplate: false, tags: [] });
    expect(await store.loadCatalog(`${base}/bad.json`)).toBe(0);
    expect(store.size).toBe(1);
  });

  it('gives up on a catalog slower than the timeout', async () => {
    routes['/slow.json'] = { body: '[]', delayMs: 500 };
    const store = new PromptStore();
    expect(await store.loadCatalog(`${base}/slow.json`, { timeoutMs: 50 })).toBe(0);
  });

  it('refuses a catalog over the size limit', async () => {
    routes['/big.json'] = { body: JSON.stringify([prompt('big', 'x'.repeat(2000))]) };
    const store = new PromptStore();
    expect(await store.loadCatalog(`${base}/big.json`, { maxBytes: 500 })).toBe(0);
    expect(store.size).toBe(0);
  });

  it.each(['http://example.com/catalog.json', 'ftp://example.com/catalog.json', 'not a url'])(
    'refuses %s without fetching it',
    async location => {
      const store = new PromptStore();
      expect(await store.loadCatalog(location)).toBe(0);
    }
  );

  it('lists the language from a prompt\'s metadata, so a client can prefer one', () => {
    const store = new PromptStore();
    store.add({ name: 'Czech', content: 'c', isTemplate: false, tags: ['t'], metadata: { language: 'cs' } });
    store.add({ name: 'Any', content: 'a', isTemplate: false, tags: ['t'] });
    const byName = Object.fromEntries(store.list({ tags: ['t'] }).map(p => [p.name, p]));
    expect(byName.Czech.language).toBe('cs');
    expect(byName.Any).not.toHaveProperty('language');
  });

  it('splits PROMPTS_EXTRA_DIRS on the platform delimiter and ignores blanks', () => {
    expect(splitDirs(['a', ' b ', '', 'c'].join(path.delimiter))).toEqual(['a', 'b', 'c']);
    expect(splitDirs(undefined)).toEqual([]);
  });
});
