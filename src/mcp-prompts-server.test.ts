import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createMcpServer, type McpServerOptions } from './mcp-prompts-server';
import { PromptStore } from './prompt-store';
import { makeFixtureLibrary, type FixtureLibrary } from './testing/fixture-library';

// The tools as a client sees them. The SDK client checks every structured result against the
// tool's advertised output schema, so a handler that returns something else fails here.

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text: string }>;
  structuredContent?: Record<string, unknown>;
}

const open: Array<() => Promise<void>> = [];

async function connect(options: McpServerOptions): Promise<Client> {
  const server = await createMcpServer(options);
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'tools-test', version: '1.0.0' });
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  // Listing the tools is what gives the client their output schemas to validate against.
  await client.listTools();
  open.push(async () => { await client.close(); await server.close(); });
  return client;
}

const call = async (client: Client, name: string, args: Record<string, unknown> = {}) =>
  (await client.callTool({ name, arguments: args })) as ToolResult;

afterEach(async () => {
  await Promise.all(open.splice(0).map(close => close()));
});

describe('tool definitions', () => {
  it('gives every tool a title, annotations, an output schema and a closed input schema', async () => {
    const client = await connect({ store: new PromptStore() });
    const { tools } = await client.listTools();
    expect(tools.map(t => t.name).sort()).toEqual([
      'add_prompt', 'apply_template', 'delete_prompt', 'get_prompt', 'get_stats', 'list_categories', 'list_prompts', 'update_prompt',
    ]);
    for (const tool of tools) {
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.outputSchema, tool.name).toBeTruthy();
      expect(tool.inputSchema.additionalProperties, tool.name).toBe(false);
      expect(tool.annotations?.openWorldHint, tool.name).toBe(false);
    }
    const hints = Object.fromEntries(tools.map(t => [t.name, t.annotations]));
    for (const name of ['list_prompts', 'list_categories', 'get_prompt', 'apply_template', 'get_stats']) {
      expect(hints[name]).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    }
    expect(hints.add_prompt).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(hints.update_prompt).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(hints.delete_prompt).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });

  it('registers only the read-only tools on a read-only server', async () => {
    const client = await connect({ store: new PromptStore(), readOnly: true });
    const { tools } = await client.listTools();
    expect(tools.every(t => t.annotations?.readOnlyHint === true)).toBe(true);
    expect(tools.map(t => t.name).sort()).toEqual(['apply_template', 'get_prompt', 'get_stats', 'list_categories', 'list_prompts']);
  });
});

describe('tools over a fixture library', () => {
  let fixture: FixtureLibrary;
  const store = () => {
    const prompts = new PromptStore();
    prompts.load({ promptsDir: fixture.library });
    return prompts;
  };

  beforeAll(() => { fixture = makeFixtureLibrary(); });
  afterAll(() => fixture.cleanup());

  it('pages list_prompts and returns the page as structured content', async () => {
    const client = await connect({ store: store() });
    const first = await call(client, 'list_prompts', { limit: 4 });
    expect(first.structuredContent).toMatchObject({ total: 6, count: 4, offset: 0, limit: 4, has_more: true, next_offset: 4 });
    expect(first.content[0].text).toContain('Found 6 prompts, showing 1-4');
    expect(first.content[0].text).toContain('offset=4');
    expect(first.content[0].text).toContain('(template)');

    const second = await call(client, 'list_prompts', { limit: 4, offset: 4 });
    expect(second.structuredContent).toMatchObject({ count: 2, has_more: false });
    const ids = [first, second].flatMap(r => (r.structuredContent!.prompts as Array<{ id: string }>).map(p => p.id));
    expect(new Set(ids).size).toBe(6);

    const templates = await call(client, 'list_prompts', { isTemplate: true, search: 'greets' });
    expect((templates.structuredContent!.prompts as Array<{ id: string }>).map(p => p.id)).toEqual(['a-greet']);
  });

  it('rejects arguments a tool does not have, naming them', async () => {
    const client = await connect({ store: store() });
    const result = await call(client, 'list_prompts', { tag: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('tag');
    expect((await call(client, 'list_prompts', { limit: 500 })).isError).toBe(true);
  });

  it('says what to do when a prompt is missing or cannot be applied', async () => {
    const client = await connect({ store: store() });
    const missing = await call(client, 'get_prompt', { id: 'nope' });
    expect(missing.isError).toBe(true);
    expect(missing.content[0].text).toBe('Prompt with ID nope not found. Call list_prompts to see the ids this server serves.');
    const plain = await call(client, 'apply_template', { id: 'a-plain', variables: {} });
    expect(plain.isError).toBe(true);
    expect(plain.content[0].text).toContain('is not a template');
  });

  it('names the variables apply_template could not fill and the ones it did not use', async () => {
    const client = await connect({ store: store() });
    const partial = await call(client, 'apply_template', { id: 'a-greet', variables: { who: 'you', plcae: 'here' } });
    expect(partial.isError).toBeFalsy();
    expect(partial.content[0].text).toBe('Hello you from {{place}}');
    expect(partial.content[1].text).toContain('Not filled: {{place}}');
    expect(partial.content[1].text).toContain('plcae');
    expect(partial.structuredContent).toEqual({ id: 'a-greet', text: 'Hello you from {{place}}', missing: ['place'], unused: ['plcae'] });

    const full = await call(client, 'apply_template', { id: 'a-greet', variables: { who: 'you', place: 'here' } });
    expect(full.content).toHaveLength(1);
    expect(full.structuredContent).toMatchObject({ text: 'Hello you from here', missing: [], unused: [] });
  });

  it('adds with a chosen id, refuses a taken one, and reports that the change is in memory only', async () => {
    const client = await connect({ store: store() });
    const added = await call(client, 'add_prompt', { id: 'team-standup', name: 'Standup', content: 'c', description: 'd', category: 'ops' });
    expect(added.structuredContent).toEqual({ id: 'team-standup', name: 'Standup', version: 1, persisted: false });
    expect(added.content[0].text).toContain('ID: team-standup\n');
    expect(added.content[0].text).toContain('memory only');
    const fetched = await call(client, 'get_prompt', { id: 'team-standup' });
    expect(fetched.structuredContent).toMatchObject({ description: 'd', category: 'ops' });

    const again = await call(client, 'add_prompt', { id: 'team-standup', name: 'Other', content: 'c' });
    expect(again.isError).toBe(true);
    expect(again.content[0].text).toContain('update_prompt');

    const updated = await call(client, 'update_prompt', { id: 'team-standup', updates: { name: 'Daily standup' } });
    expect(updated.structuredContent).toMatchObject({ name: 'Daily standup', version: 2 });
    expect((await call(client, 'update_prompt', { id: 'team-standup', updates: {} })).content[0].text).toContain('Nothing to update');
    expect((await call(client, 'update_prompt', { id: 'team-standup', updates: { nmae: 'x' } })).isError).toBe(true);
    expect((await call(client, 'delete_prompt', { id: 'team-standup' })).structuredContent).toMatchObject({ id: 'team-standup' });
    expect((await call(client, 'delete_prompt', { id: 'team-standup' })).isError).toBe(true);
  });

  it('saves changes when the store has a state directory, and says so', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-tools-state-'));
    const withState = () => {
      const prompts = store();
      prompts.openStateDir(dir);
      return prompts;
    };
    const client = await connect({ store: withState() });
    expect(client.getInstructions()).toContain('survive a restart');
    const added = await call(client, 'add_prompt', { id: 'kept', name: 'Kept', content: 'c' });
    expect(added.structuredContent).toMatchObject({ persisted: true });
    expect(added.content[0].text).toContain('survives a restart');
    expect((await call(client, 'get_stats')).structuredContent).toMatchObject({ storage: 'file', total: 7 });

    const restarted = await connect({ store: withState() });
    expect((await call(restarted, 'get_prompt', { id: 'kept' })).structuredContent).toMatchObject({ name: 'Kept' });
    fs.rmSync(dir, { recursive: true, force: true });
  });
});

describe('tools over the bundled library', () => {
  it('returns every bundled prompt in a form that matches the advertised schema', async () => {
    const prompts = new PromptStore();
    prompts.load();
    const client = await connect({ store: prompts });
    const stats = await call(client, 'get_stats');
    const total = stats.structuredContent!.total as number;
    expect(total).toBeGreaterThan(0);
    expect((stats.structuredContent!.categories as string[]).length).toBeGreaterThan(0);

    const ids: string[] = [];
    for (let offset = 0; offset < total; offset += 20) {
      const page = await call(client, 'list_prompts', { limit: 20, offset });
      ids.push(...(page.structuredContent!.prompts as Array<{ id: string }>).map(p => p.id));
    }
    expect(ids).toHaveLength(total);
    for (const id of ids) {
      // callTool throws if the structured content does not match get_prompt's output schema.
      const result = await call(client, 'get_prompt', { id });
      expect(result.isError, id).toBeFalsy();
    }
  });

  it('fills the bundled Gradle template, capitalised task names included', async () => {
    const prompts = new PromptStore();
    prompts.load();
    const client = await connect({ store: prompts });
    const id = 'claudepy-android-build-test-cycle';
    const variables = Object.fromEntries(
      (prompts.get(id).variables ?? []).map(v => [typeof v === 'string' ? v : v.name, 'debug'])
    );
    const result = await call(client, 'apply_template', { id, variables });
    expect(result.structuredContent).toMatchObject({ missing: [], unused: [] });
    expect(result.content[0].text).toContain('assembleDebug');
    expect(result.content[0].text).not.toContain('{{');
  });
});

describe('context budget', () => {
  const library = async () => {
    const store = new PromptStore();
    for (let i = 0; i < 60; i++) {
      await store.add({
        id: `p${i}`, name: `P${i}`, description: 'd', content: 'c', isTemplate: i % 2 === 0, tags: [],
        category: i < 40 ? 'embedded' : 'workflow',
      });
    }
    return store;
  };

  it('lists categories with counts, without prompt content', async () => {
    const client = await connect({ store: await library() });
    const result = await call(client, 'list_categories');
    expect(result.structuredContent).toEqual({
      categories: [
        { category: 'embedded', count: 40, templates: 20 },
        { category: 'workflow', count: 20, templates: 10 },
      ],
    });
    expect(result.content[0].text.length).toBeLessThan(500);
  });

  it('returns at most 20 prompts by default', async () => {
    const client = await connect({ store: await library() });
    const page = await call(client, 'list_prompts');
    expect(page.structuredContent).toMatchObject({ total: 60, count: 20, limit: 20, has_more: true, next_offset: 20 });
  });

  it('keeps a page of 50 prompts small however long their descriptions are', async () => {
    const store = new PromptStore();
    for (let i = 0; i < 50; i++) {
      await store.add({ id: `huge-${i}`, name: `Huge ${i}`, description: `${'D'.repeat(100_000)}`, content: 'c', isTemplate: false, tags: ['huge'], category: 'big' });
    }
    const client = await connect({ store });
    const page = await call(client, 'list_prompts', { limit: 50 });
    const rows = (page.structuredContent as { prompts: Array<{ description: string }> }).prompts;
    expect(rows).toHaveLength(50);
    for (const row of rows) {
      expect(row.description.length).toBeLessThanOrEqual(110);
      expect(row.description.endsWith('\u2026')).toBe(true);
    }
    const bytes = Buffer.byteLength(JSON.stringify(page));
    expect(bytes).toBeLessThan(30_000);
    // The whole description is one get_prompt away.
    const whole = await call(client, 'get_prompt', { id: 'huge-0' });
    expect((whole.structuredContent as { description: string }).description).toHaveLength(100_000);
  });

  it('leaves a short description as it is', async () => {
    const store = new PromptStore();
    await store.add({ id: 'short', name: 'Short', description: 'x'.repeat(110), content: 'c', isTemplate: false, tags: [] });
    const page = await call(await connect({ store }), 'list_prompts');
    expect((page.structuredContent as { prompts: Array<{ description: string }> }).prompts[0].description).toBe('x'.repeat(110));
  });

  it('tells the model to go by category first and that lists are capped', async () => {
    const instructions = (await connect({ store: await library() })).getInstructions() ?? '';
    const at = (needle: string) => {
      const index = instructions.indexOf(needle);
      expect(index, needle).toBeGreaterThanOrEqual(0);
      return index;
    };
    expect(at('list_categories')).toBeLessThan(at('list_prompts'));
    expect(at('list_prompts')).toBeLessThan(at('get_prompt'));
    expect(at('get_prompt')).toBeLessThan(at('apply_template'));
    expect(instructions).toMatch(/category/);
    expect(instructions).toMatch(/capped|at most 50/);
    expect(instructions).toContain('default 20');
    expect(instructions).toContain('next_offset');
    // The usage notes stay short: they are in the model's context all the time.
    expect(instructions.length).toBeLessThan(2_000);
  });

  it('refuses a page over 50 prompts', async () => {
    const client = await connect({ store: await library() });
    expect((await call(client, 'list_prompts', { limit: 51 })).isError).toBe(true);
    expect((await call(client, 'list_prompts', { limit: 50 })).isError).toBeFalsy();
  });
});

describe('listing prompts and resources over MCP', () => {
  const bigStore = async (count: number) => {
    const store = new PromptStore();
    for (let i = 0; i < count; i++) {
      await store.add({ id: `bulk-${i}`, name: `Bulk ${i}`, description: i === 0 ? 'D'.repeat(50_000) : 'd', content: 'c', isTemplate: false, tags: [] });
    }
    return store;
  };

  it('pages prompts/list and resources/list at 50 and reaches every prompt by following nextCursor', async () => {
    const client = await connect({ store: await bigStore(5_000), expose: ['tools', 'prompts', 'resources'] });
    const seenPrompts: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await client.listPrompts(cursor ? { cursor } : undefined);
      expect(page.prompts.length).toBeLessThanOrEqual(50);
      for (const prompt of page.prompts) {
        expect((prompt.description ?? '').length).toBeLessThanOrEqual(110);
        seenPrompts.push(prompt.name);
      }
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(100);
    expect(new Set(seenPrompts).size).toBe(5_000);

    const seenResources = new Set<string>();
    cursor = undefined;
    do {
      const page = await client.listResources(cursor ? { cursor } : undefined);
      expect(page.resources.length).toBeLessThanOrEqual(50);
      for (const resource of page.resources) {
        expect((resource.description ?? '').length).toBeLessThanOrEqual(110);
        seenResources.add(resource.uri);
      }
      cursor = page.nextCursor;
    } while (cursor);
    expect(seenResources.size).toBe(5_000);
  }, 60_000);

  it('gives no cursor when everything fits one page, and refuses a cursor it did not give', async () => {
    const client = await connect({ store: await bigStore(3), expose: ['tools', 'prompts', 'resources'] });
    const page = await client.listPrompts();
    expect(page.prompts).toHaveLength(3);
    expect(page.nextCursor).toBeUndefined();
    await expect(client.listPrompts({ cursor: 'not-a-cursor' })).rejects.toThrow(/cursor/i);
    await expect(client.listResources({ cursor: 'not-a-cursor' })).rejects.toThrow(/cursor/i);
  });
});
