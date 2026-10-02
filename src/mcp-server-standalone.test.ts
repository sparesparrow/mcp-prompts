import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Runs the real npm bin entry as a subprocess, the way an MCP client does. The module
// starts its stdio server on import, so it cannot be imported into a test.
describe('standalone MCP server (stdio)', () => {
  let client: Client;
  let dir: string;

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-prompts-'));
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
    env.PROMPTS_DIR = dir;
    client = new Client({ name: 'test', version: '0.0.0' }, { capabilities: {} });
    await client.connect(
      new StdioClientTransport({
        command: path.resolve('node_modules/.bin/tsx'),
        args: ['src/mcp-server-standalone.ts'],
        env,
        stderr: 'ignore',
      })
    );
  }, 30000);

  afterAll(async () => {
    await client?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const text = (r: any) => (r.content as any[]).map((c) => c.text).join('');

  it('advertises an input schema for every tool that takes arguments', async () => {
    const { tools } = await client.listTools();
    const props = (name: string) => Object.keys((tools.find((t) => t.name === name) as any).inputSchema.properties ?? {});
    expect(props('add_prompt')).toEqual(expect.arrayContaining(['name', 'content']));
    expect(props('get_prompt')).toEqual(['id']);
    expect(props('update_prompt')).toEqual(expect.arrayContaining(['id', 'updates']));
    expect(props('delete_prompt')).toEqual(['id']);
    expect(props('apply_template')).toEqual(expect.arrayContaining(['id', 'variables']));
    expect(props('list_prompts')).toEqual(expect.arrayContaining(['tags', 'search']));
  }, 30000);

  it('adds, reads, updates, applies and deletes a prompt', async () => {
    const added = await client.callTool({
      name: 'add_prompt',
      arguments: { name: 'greeting', content: 'Hello {{who}}', isTemplate: true },
    });
    expect(added.isError).toBeFalsy();
    const id = /ID: (\S+)/.exec(text(added))![1];

    expect(text(await client.callTool({ name: 'get_prompt', arguments: { id } }))).toContain('Hello {{who}}');

    const updated = await client.callTool({ name: 'update_prompt', arguments: { id, updates: { content: 'Hi {{who}}' } } });
    expect(updated.isError).toBeFalsy();

    const applied = await client.callTool({ name: 'apply_template', arguments: { id, variables: { who: 'world' } } });
    expect(text(applied)).toContain('Hi world');

    const deleted = await client.callTool({ name: 'delete_prompt', arguments: { id } });
    expect(deleted.isError).toBeFalsy();
    const gone = await client.callTool({ name: 'get_prompt', arguments: { id } });
    expect(gone.isError).toBe(true);
  }, 30000);
});
